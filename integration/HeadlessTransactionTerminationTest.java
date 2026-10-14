import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Locale;
import java.util.Properties;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

/**
 * Headless server/JDBC termination acceptance.
 *
 * <p>This deliberately does not drive DBeaver UI. It terminates one connection created by this
 * process only after an independent controller has matched its PID, application name, database,
 * user, active state and exact sleep query in pg_stat_activity.</p>
 */
public final class HeadlessTransactionTerminationTest {
    private static final String SLEEP_SQL = "SELECT pg_sleep(120)";
    private static final String TEST_NAME = "transaction-termination";
    private static final String SCOPE = "server-jdbc";

    private HeadlessTransactionTerminationTest() {
    }

    public static void main(String[] args) throws Exception {
        Checks checks = new Checks();
        Throwable failure = null;
        try {
            run(args, checks);
        } catch (Throwable caught) {
            failure = caught;
            if (checks.failed == 0) {
                checks.fail("unexpected headless termination failure");
            }
        } finally {
            checks.finish(failure == null);
        }
        if (failure instanceof Exception) {
            throw (Exception) failure;
        }
        if (failure instanceof Error) {
            throw (Error) failure;
        }
    }

    private static void run(String[] args, Checks checks) throws Throwable {
        if (args.length != 1 || !"YES".equals(System.getenv("GAUSSDB_HISTORY_ALLOW_DDL"))) {
            throw new IllegalArgumentException(
                "One private connection file and explicit isolated DDL consent are required");
        }
        Properties base = new Properties();
        try (InputStream input = Files.newInputStream(Paths.get(args[0]))) {
            base.load(input);
        }
        Class.forName(required(base, "driverClass"));
        String url = required(base, "url");
        base.setProperty("socketTimeout", "150");
        base.setProperty("connectTimeout", "10");

        String token = UUID.randomUUID().toString().replace("-", "");
        String marker = "dbv_headless_tx_" + token;
        String schema = "dbv_headless_tx_" + UUID.randomUUID().toString().replace("-", "");
        System.out.println("MODE HEADLESS test=" + TEST_NAME + " scope=" + SCOPE + " gui=false");

        ExecutorService targetWorker = Executors.newSingleThreadExecutor();
        Throwable primary = null;
        boolean schemaCreated = false;
        Future<String> targetJob = null;
        long targetPid = -1;
        Identity targetIdentity = null;
        Connection observer = null;
        Connection controller = null;
        Connection target = null;
        try {
            observer = connect(url, base, marker + "_observer");
            controller = connect(url, base, marker + "_controller");
            target = connect(url, base, marker);
            execute(observer, "CREATE SCHEMA " + schema);
            schemaCreated = true;
            execute(observer, "CREATE TABLE " + schema + ".audit(id integer PRIMARY KEY)");
            execute(observer, "INSERT INTO " + schema + ".audit VALUES(1)");

            target.setAutoCommit(false);
            execute(target, "INSERT INTO " + schema + ".audit VALUES(2)");
            checks.require(count(target, schema + ".audit") == 2
                    && count(observer, schema + ".audit") == 1,
                "fixture visibility isolates the uncommitted row");

            targetIdentity = ownIdentity(target);
            targetPid = targetIdentity.pid;
            checks.require(targetPid > 0 && marker.equals(targetIdentity.applicationName),
                "target identity is positive and marker-bound");
            System.out.println("TARGET " + marker + " PID=" + targetPid);
            System.out.println("BEFORE targetRows=2 observerRows=1 schema=" + schema);

            final Connection targetConnection = target;
            targetJob = targetWorker.submit(() -> runTargetWait(targetConnection));

            Snapshot snapshot = awaitExactActiveTarget(controller, targetIdentity, SLEEP_SQL, 10);
            checks.require(snapshot != null,
                "controller matched the exact active target");
            System.out.println("CONTROLLER MATCH marker=" + marker + " pid=" + targetPid + " state=active");

            checks.require(terminate(controller, targetPid),
                "server acknowledged target termination");
            System.out.println("TERMINATE ACK=true pid=" + targetPid);

            String state = targetJob.get(20, TimeUnit.SECONDS);
            checks.require(isTerminationState(state),
                "target reported a termination SQLSTATE");
            System.out.println("INTERRUPTED SQLSTATE=" + state);
            checks.require(isInvalid(target),
                "terminated target connection is invalid");

            checks.require(count(observer, schema + ".audit") == 1
                    && countWhere(observer, schema + ".audit", 2) == 0,
                "uncommitted target row was rolled back");

            try (Connection fresh = connect(url, base, marker + "_fresh")) {
                execute(fresh, "INSERT INTO " + schema + ".audit VALUES(3)");
            }
            checks.require(count(observer, schema + ".audit") == 2
                    && countWhere(observer, schema + ".audit", 3) == 1,
                "fresh connection committed a replacement row");
        } catch (Throwable caught) {
            primary = caught;
            throw caught;
        } finally {
            Throwable cleanupFailure = null;
            if (targetJob != null && !targetJob.isDone()) {
                Connection fallback = controller;
                boolean closeFallback = false;
                try {
                    if (targetIdentity == null || targetPid <= 0) {
                        throw new AssertionError("Refusing fallback termination without a verified target identity");
                    }
                    if (fallback == null || fallback.isClosed()) {
                        fallback = connect(url, base, marker + "_fallback");
                        closeFallback = true;
                    }
                    Snapshot snapshot;
                    try {
                        snapshot = readSnapshot(fallback, targetPid);
                    } catch (SQLException controllerFailure) {
                        if (closeFallback) {
                            throw controllerFailure;
                        }
                        fallback = connect(url, base, marker + "_fallback");
                        closeFallback = true;
                        snapshot = readSnapshot(fallback, targetPid);
                    }
                    if (snapshot != null) {
                        if (!matchesExactTarget(snapshot, targetIdentity, SLEEP_SQL)) {
                            throw new AssertionError("Refusing fallback termination after target identity changed");
                        }
                        if (!terminate(fallback, targetPid)) {
                            throw new AssertionError("Server did not acknowledge fallback termination");
                        }
                        System.out.println("CLEANUP TERMINATE exact=true pid=" + targetPid);
                    }
                    try {
                        targetJob.get(10, TimeUnit.SECONDS);
                    } catch (Throwable waitFailure) {
                        cleanupFailure = append(cleanupFailure, waitFailure);
                    }
                } catch (Throwable fallbackFailure) {
                    cleanupFailure = append(cleanupFailure, fallbackFailure);
                } finally {
                    if (closeFallback) {
                        cleanupFailure = close(fallback, cleanupFailure);
                    }
                }
                targetJob.cancel(true);
            }
            targetWorker.shutdownNow();
            if (!targetWorker.awaitTermination(5, TimeUnit.SECONDS)) {
                cleanupFailure = append(cleanupFailure, new AssertionError("Target worker did not terminate"));
            }
            cleanupFailure = close(target, cleanupFailure);
            cleanupFailure = close(controller, cleanupFailure);
            cleanupFailure = close(observer, cleanupFailure);
            if (schemaCreated) {
                try (Connection cleanup = connect(url, base, marker + "_cleanup")) {
                    execute(cleanup, "DROP TABLE IF EXISTS " + schema + ".audit");
                    execute(cleanup, "DROP SCHEMA " + schema + " RESTRICT");
                    System.out.println("CLEANED " + schema);
                    checks.require(true, "isolated schema was cleaned");
                } catch (Throwable schemaCleanupFailure) {
                    cleanupFailure = append(cleanupFailure, schemaCleanupFailure);
                }
            }
            if (cleanupFailure != null) {
                if (primary != null) {
                    primary.addSuppressed(cleanupFailure);
                } else {
                    throw cleanupFailure;
                }
            }
        }
    }

    private static Connection connect(String url, Properties base, String applicationName) throws SQLException {
        Properties properties = new Properties();
        properties.putAll(base);
        properties.setProperty("ApplicationName", applicationName);
        return DriverManager.getConnection(url, properties);
    }

    private static Identity ownIdentity(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.setQueryTimeout(10);
            try (ResultSet rows = statement.executeQuery(
                    "SELECT pg_backend_pid(),current_database(),current_user,current_setting('application_name')")) {
                if (!rows.next()) {
                    throw new AssertionError("Missing target identity");
                }
                Identity identity = new Identity(rows.getLong(1), rows.getString(2), rows.getString(3), rows.getString(4));
                if (rows.wasNull() || rows.next()) {
                    throw new AssertionError("Target identity is null or duplicated");
                }
                return identity;
            }
        }
    }

    private static String runTargetWait(Connection target) throws Exception {
        try (Statement statement = target.createStatement()) {
            // This is a safety bound, not the action under test. The controller must terminate first.
            statement.setQueryTimeout(60);
            statement.execute(SLEEP_SQL);
            throw new AssertionError("Target wait completed without termination");
        } catch (SQLException failure) {
            if (!isTerminationState(failure.getSQLState())) {
                throw failure;
            }
            return failure.getSQLState();
        }
    }

    private static Snapshot awaitExactActiveTarget(
        Connection controller,
        Identity expected,
        String expectedQuery,
        int timeoutSeconds
    ) throws Exception {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(timeoutSeconds);
        while (System.nanoTime() < deadline) {
            Snapshot snapshot = readSnapshot(controller, expected.pid);
            if (snapshot != null) {
                if (!expected.applicationName.equals(snapshot.applicationName)
                    || !expected.database.equals(snapshot.database)
                    || !expected.user.equals(snapshot.user)) {
                    throw new AssertionError("PID identity changed before termination");
                }
                if (matchesExactTarget(snapshot, expected, expectedQuery)) {
                    return snapshot;
                }
            }
            Thread.sleep(50);
        }
        throw new AssertionError("Exact target never entered the expected active wait");
    }

    private static boolean matchesExactTarget(Snapshot snapshot, Identity expected, String expectedQuery) {
        return expected.applicationName.equals(snapshot.applicationName)
            && expected.database.equals(snapshot.database)
            && expected.user.equals(snapshot.user)
            && "active".equals(snapshot.state)
            && normalizeSql(expectedQuery).equals(normalizeSql(snapshot.query));
    }

    private static Snapshot readSnapshot(Connection controller, long pid) throws SQLException {
        try (PreparedStatement statement = controller.prepareStatement(
                "SELECT application_name,datname,usename,state,query "
                    + "FROM pg_catalog.pg_stat_activity WHERE pid=?")) {
            statement.setQueryTimeout(5);
            statement.setLong(1, pid);
            try (ResultSet rows = statement.executeQuery()) {
                if (!rows.next()) {
                    return null;
                }
                Snapshot snapshot = new Snapshot(
                    rows.getString(1), rows.getString(2), rows.getString(3), rows.getString(4), rows.getString(5));
                if (rows.next()) {
                    throw new AssertionError("PID matched more than one server session");
                }
                return snapshot;
            }
        }
    }

    private static boolean terminate(Connection controller, long pid) throws SQLException {
        try (PreparedStatement statement = controller.prepareStatement(
                "SELECT pg_catalog.pg_terminate_backend(?)")) {
            statement.setQueryTimeout(10);
            statement.setLong(1, pid);
            try (ResultSet rows = statement.executeQuery()) {
                if (!rows.next()) {
                    return false;
                }
                boolean acknowledged = rows.getBoolean(1);
                boolean nullValue = rows.wasNull();
                if (rows.next()) {
                    throw new AssertionError("Termination returned multiple acknowledgements");
                }
                return acknowledged && !nullValue;
            }
        }
    }

    private static boolean isInvalid(Connection connection) {
        try {
            return !connection.isValid(2);
        } catch (SQLException failure) {
            return isTerminationState(failure.getSQLState());
        }
    }

    private static boolean isTerminationState(String state) {
        return "57P01".equals(state) || (state != null && state.startsWith("08"));
    }

    private static Throwable close(Connection connection, Throwable previous) {
        if (connection == null) {
            return previous;
        }
        try {
            connection.close();
            return previous;
        } catch (Throwable failure) {
            return append(previous, failure);
        }
    }

    private static Throwable append(Throwable previous, Throwable next) {
        if (previous == null) {
            return next;
        }
        if (previous != next) {
            previous.addSuppressed(next);
        }
        return previous;
    }

    private static String normalizeSql(String sql) {
        if (sql == null) {
            return "";
        }
        String normalized = sql.trim().replaceAll("\\s+", " ").toUpperCase(Locale.ENGLISH);
        return normalized.endsWith(";") ? normalized.substring(0, normalized.length() - 1).trim() : normalized;
    }

    private static void execute(Connection connection, String sql) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.setQueryTimeout(15);
            statement.execute(sql);
        }
    }

    private static long count(Connection connection, String table) throws SQLException {
        return scalar(connection, "SELECT count(*) FROM " + table);
    }

    private static long countWhere(Connection connection, String table, int id) throws SQLException {
        return scalar(connection, "SELECT count(*) FROM " + table + " WHERE id=" + id);
    }

    private static long scalar(Connection connection, String sql) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.setQueryTimeout(15);
            try (ResultSet rows = statement.executeQuery(sql)) {
                if (!rows.next()) {
                    throw new AssertionError("Missing scalar result");
                }
                long value = rows.getLong(1);
                if (rows.wasNull() || rows.next()) {
                    throw new AssertionError("Scalar result is null or duplicated");
                }
                return value;
            }
        }
    }

    private static String required(Properties properties, String key) {
        String value = properties.getProperty(key);
        if (value == null || value.trim().isEmpty()) {
            throw new IllegalArgumentException("Missing required connection property: " + key);
        }
        return value.trim();
    }

    private static final class Identity {
        final long pid;
        final String database;
        final String user;
        final String applicationName;

        Identity(long pid, String database, String user, String applicationName) {
            this.pid = pid;
            this.database = database;
            this.user = user;
            this.applicationName = applicationName;
        }
    }

    private static final class Snapshot {
        final String applicationName;
        final String database;
        final String user;
        final String state;
        final String query;

        Snapshot(String applicationName, String database, String user, String state, String query) {
            this.applicationName = applicationName;
            this.database = database;
            this.user = user;
            this.state = state;
            this.query = query;
        }
    }

    private static final class Checks {
        int total;
        int passed;
        int failed;

        void require(boolean condition, String label) {
            total++;
            if (condition) {
                passed++;
                System.out.println("PASS " + label);
                return;
            }
            failed++;
            System.out.println("FAIL " + label);
            throw new AssertionError(label);
        }

        void fail(String label) {
            total++;
            failed++;
            System.out.println("FAIL " + label);
        }

        void finish(boolean successful) {
            System.out.println("TOTAL CHECKS " + total + " PASS " + passed + " FAIL " + failed);
            System.out.println("RESULT " + (successful && failed == 0 ? "PASS" : "FAIL")
                + " test=" + TEST_NAME + " scope=" + SCOPE + " gui=false");
        }
    }
}
