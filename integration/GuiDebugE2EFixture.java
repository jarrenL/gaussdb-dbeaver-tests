import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.Driver;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Properties;

/** Two-database, ordinary-account fixture for repeatable debugger workflow acceptance. */
public final class GuiDebugE2EFixture {
    static final String SCHEMA = "dbv_debug_e2e_repeatable";
    static final int DATABASE_A_TAG = 101;
    static final int DATABASE_B_TAG = 202;
    static final int LOCAL_VARIABLES = 64;
    static final int ASSIGNMENT_ROUNDS = 3;

    private GuiDebugE2EFixture() {
    }

    public static void main(String[] args) throws Exception {
        if (args.length != 3 || !List.of("setup", "verify", "cleanup").contains(args[0])
            || !"YES".equals(System.getenv("GAUSSDB_HISTORY_ALLOW_DDL"))) {
            throw new IllegalArgumentException(
                "Usage: GuiDebugE2EFixture setup|verify|cleanup <database-a.properties> <database-b.properties>; "
                    + "explicit GAUSSDB_HISTORY_ALLOW_DDL=YES required");
        }
        try (Connection databaseA = connect(Path.of(args[1])); Connection databaseB = connect(Path.of(args[2]))) {
            String nameA = scalar(databaseA, "SELECT current_database()");
            String nameB = scalar(databaseB, "SELECT current_database()");
            if (nameA.equals(nameB)) {
                throw new IllegalArgumentException("Two distinct databases are required for A-to-B-to-A isolation");
            }
            switch (args[0]) {
                case "setup": setupPair(databaseA, databaseB); break;
                case "verify": verifyOne(databaseA, DATABASE_A_TAG); verifyOne(databaseB, DATABASE_B_TAG); break;
                case "cleanup": cleanupPair(databaseA, databaseB); break;
                default: throw new IllegalArgumentException("Unknown action");
            }
        }
        System.out.println("COMPLETED debugger E2E fixture action " + args[0]);
    }

    static Connection connect(Path file) throws Exception {
        Properties properties = load(file);
        String driverClass = required(properties, "driverClass");
        String url = required(properties, "url");
        Class<?> loaded = Class.forName(driverClass);
        if (!Driver.class.isAssignableFrom(loaded)) {
            throw new IllegalArgumentException("Configured driverClass does not implement java.sql.Driver");
        }
        Driver driver = (Driver) loaded.getDeclaredConstructor().newInstance();
        if (!driver.acceptsURL(url)) {
            throw new IllegalArgumentException("Configured driverClass does not accept the configured JDBC URL");
        }
        Properties connectionProperties = new Properties();
        connectionProperties.putAll(properties);
        connectionProperties.remove("driverClass");
        connectionProperties.putIfAbsent("connectTimeout", "10");
        connectionProperties.putIfAbsent("socketTimeout", "20");
        Connection connection = driver.connect(url, connectionProperties);
        if (connection == null) {
            throw new SQLException("Configured JDBC driver declined the connection URL");
        }
        return connection;
    }

    private static Properties load(Path file) throws IOException {
        Properties properties = new Properties();
        try (var input = Files.newInputStream(file)) {
            properties.load(input);
        }
        return properties;
    }

    static String required(Properties properties, String key) {
        String value = properties.getProperty(key);
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Missing required connection property: " + key);
        }
        return value.strip();
    }

    private static void setupPair(Connection databaseA, Connection databaseB) throws SQLException {
        boolean createdA = false;
        boolean createdB = false;
        Throwable failure = null;
        try {
            setupOne(databaseA, DATABASE_A_TAG);
            createdA = true;
            setupOne(databaseB, DATABASE_B_TAG);
            createdB = true;
            verifyOne(databaseA, DATABASE_A_TAG);
            verifyOne(databaseB, DATABASE_B_TAG);
        } catch (SQLException | RuntimeException error) {
            failure = error;
            throw error;
        } finally {
            if (failure != null) {
                List<Throwable> cleanupFailures = new ArrayList<>();
                if (createdB) cleanupAfterFailedSetup(databaseB, cleanupFailures);
                if (createdA) cleanupAfterFailedSetup(databaseA, cleanupFailures);
                for (Throwable cleanupFailure : cleanupFailures) failure.addSuppressed(cleanupFailure);
            }
        }
    }

    private static void cleanupAfterFailedSetup(Connection connection, List<Throwable> failures) {
        try { cleanupOne(connection); } catch (Throwable cleanup) { failures.add(cleanup); }
    }

    static void setupOne(Connection connection, int databaseTag) throws SQLException {
        transaction(connection, () -> {
            execute(connection, "CREATE SCHEMA " + SCHEMA);
            execute(connection, "CREATE TABLE " + SCHEMA + ".audit(id integer)");
            execute(connection, "INSERT INTO " + SCHEMA + ".audit VALUES(1)");
            execute(connection, sameNameSql(databaseTag));
            execute(connection, largeLocalsSql(databaseTag));
            execute(connection, waitSql());
        });
    }

    static void verifyOne(Connection connection, int databaseTag) throws SQLException {
        owned(connection);
        check(connection, "SELECT count(*) FROM " + SCHEMA + ".audit", 1);
        check(connection, "SELECT count(*) FROM " + SCHEMA + ".audit WHERE id=1", 1);
        check(connection, "SELECT count(*) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n "
            + "ON n.oid=p.pronamespace WHERE n.nspname='" + SCHEMA
            + "' AND p.proname IN ('same_name','large_locals','write_then_wait')", 3);
        String sameName = routineSource(connection, "same_name");
        String large = routineSource(connection, "large_locals");
        String wait = routineSource(connection, "write_then_wait");
        String tag = "v_database_tag integer := " + databaseTag + ";";
        if (!sameName.contains(tag) || !large.contains(tag)) {
            throw new IllegalStateException("Database-specific debugger tag is missing");
        }
        if (!wait.contains("pg_sleep(300)")) {
            throw new IllegalStateException("Running-termination target is missing its wait");
        }
        if (lineCount(large) < 200 || declarationCount(large) != LOCAL_VARIABLES) {
            throw new IllegalStateException("Large-source fixture is smaller than its declared contract");
        }
    }

    private static void cleanupPair(Connection databaseA, Connection databaseB) throws SQLException {
        // Check both databases before changing either. RESTRICT remains the final guard against a race.
        preflightCleanup(databaseA, DATABASE_A_TAG);
        preflightCleanup(databaseB, DATABASE_B_TAG);
        List<SQLException> failures = new ArrayList<>();
        try { cleanupOne(databaseB); } catch (SQLException failure) { failures.add(failure); }
        try { cleanupOne(databaseA); } catch (SQLException failure) { failures.add(failure); }
        if (!failures.isEmpty()) {
            SQLException failure = new SQLException("Debugger E2E fixture cleanup incomplete");
            for (SQLException suppressed : failures) failure.addSuppressed(suppressed);
            throw failure;
        }
    }

    private static void preflightCleanup(Connection connection, int databaseTag) throws SQLException {
        verifyOne(connection, databaseTag);
        check(connection, "SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n "
            + "ON n.oid=c.relnamespace WHERE n.nspname='" + SCHEMA + "' AND c.relname<>'audit'", 0);
        check(connection, "SELECT count(*) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n "
            + "ON n.oid=p.pronamespace WHERE n.nspname='" + SCHEMA
            + "' AND p.proname NOT IN ('same_name','large_locals','write_then_wait')", 0);
    }

    static void cleanupOne(Connection connection) throws SQLException {
        transaction(connection, () -> {
            owned(connection);
            for (String statement : cleanupStatements()) execute(connection, statement);
        });
    }

    static String sameNameSql(int databaseTag) {
        return "CREATE PROCEDURE " + SCHEMA + ".same_name(p_seed integer) AS DECLARE\n"
            + "v_value integer := p_seed + 1;\n"
            + "v_database_tag integer := " + databaseTag + ";\n"
            + "BEGIN\n"
            + "v_value := v_value + v_database_tag;\n"
            + "v_value := v_value + 1;\n"
            + "END;";
    }

    static String largeLocalsSql(int databaseTag) {
        StringBuilder sql = new StringBuilder("CREATE PROCEDURE ").append(SCHEMA)
            .append(".large_locals(p_seed integer) AS DECLARE\n")
            .append("v_database_tag integer := ").append(databaseTag).append(";\n");
        for (int index = 1; index <= LOCAL_VARIABLES; index++) {
            sql.append(localName(index)).append(" integer := p_seed + ").append(index).append(";\n");
        }
        sql.append("BEGIN\n");
        for (int round = 1; round <= ASSIGNMENT_ROUNDS; round++) {
            for (int index = 1; index <= LOCAL_VARIABLES; index++) {
                String local = localName(index);
                sql.append(local).append(" := ").append(local).append(" + ").append(round).append(";\n");
            }
        }
        sql.append("v_database_tag := v_database_tag + 0;\nEND;");
        return sql.toString();
    }

    static String waitSql() {
        return "CREATE PROCEDURE " + SCHEMA + ".write_then_wait(p_id integer) AS\n"
            + "BEGIN\n"
            + "INSERT INTO " + SCHEMA + ".audit VALUES(p_id);\n"
            + "PERFORM pg_sleep(300);\n"
            + "END;";
    }

    static List<String> cleanupStatements() {
        return List.of(
            "DROP PROCEDURE " + SCHEMA + ".write_then_wait(integer) RESTRICT",
            "DROP PROCEDURE " + SCHEMA + ".large_locals(integer) RESTRICT",
            "DROP PROCEDURE " + SCHEMA + ".same_name(integer) RESTRICT",
            "DROP TABLE " + SCHEMA + ".audit RESTRICT",
            "DROP SCHEMA " + SCHEMA + " RESTRICT");
    }

    private static String localName(int index) {
        return String.format("v_local_%02d", index);
    }

    static int lineCount(String source) {
        if (source.isEmpty()) return 0;
        int lines = 1;
        for (int index = 0; index < source.length(); index++) if (source.charAt(index) == '\n') lines++;
        return lines;
    }

    static int declarationCount(String source) {
        int count = 0;
        for (String line : source.split("\\R")) {
            if (line.matches("v_local_[0-9]{2} integer := p_seed \\+ [0-9]+;")) count++;
        }
        return count;
    }

    private static String routineSource(Connection connection, String routine) throws SQLException {
        String sql = "SELECT p.prosrc FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n "
            + "ON n.oid=p.pronamespace WHERE n.nspname='" + SCHEMA + "' AND p.proname='" + routine + "'";
        try (Statement statement = connection.createStatement()) {
            statement.setQueryTimeout(15);
            try (ResultSet rows = statement.executeQuery(sql)) {
                if (!rows.next()) throw new IllegalStateException("Missing fixture routine: " + routine);
                String source = rows.getString(1);
                if (source == null || rows.wasNull() || rows.next()) {
                    throw new IllegalStateException("Fixture routine is null or ambiguous: " + routine);
                }
                return source;
            }
        }
    }

    private static void owned(Connection connection) throws SQLException {
        check(connection, "SELECT count(*) FROM pg_catalog.pg_namespace WHERE nspname='" + SCHEMA
            + "' AND nspowner=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname=current_user)", 1);
    }

    static void execute(Connection connection, String sql) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.setQueryTimeout(15);
            statement.execute(sql);
        }
    }

    static void check(Connection connection, String sql, int expected) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.setQueryTimeout(15);
            try (ResultSet rows = statement.executeQuery(sql)) {
                if (!rows.next() || rows.getInt(1) != expected || rows.next()) {
                    throw new IllegalStateException("Fixture assertion failed");
                }
            }
        }
    }

    private static String scalar(Connection connection, String sql) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.setQueryTimeout(15);
            try (ResultSet rows = statement.executeQuery(sql)) {
                if (!rows.next()) throw new IllegalStateException("Fixture identity query returned no row");
                String value = rows.getString(1);
                if (value == null || rows.wasNull() || rows.next()) {
                    throw new IllegalStateException("Fixture identity query was null or ambiguous");
                }
                return value;
            }
        }
    }

    private static void transaction(Connection connection, SqlAction action) throws SQLException {
        if (!connection.getAutoCommit()) throw new IllegalStateException("Dedicated auto-commit connection required");
        connection.setAutoCommit(false);
        try {
            action.run();
            connection.commit();
        } catch (SQLException | RuntimeException failure) {
            try { connection.rollback(); } catch (SQLException rollback) { failure.addSuppressed(rollback); }
            throw failure;
        } finally {
            connection.setAutoCommit(true);
        }
    }

    @FunctionalInterface
    private interface SqlAction {
        void run() throws SQLException;
    }
}
