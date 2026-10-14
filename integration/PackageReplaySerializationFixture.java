import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

/**
 * Proves the cooperative lock contract used by DBeaver package persistence and
 * distributed package source replay.
 *
 * <p>Connection A represents the source-replay compiler. It opens a repeatable-read
 * transaction, obtains the package advisory transaction lock, and reads BODY=42.
 * Connection B represents a concurrent DBeaver package save. It cannot obtain the
 * same lock while A holds it. After A commits, B obtains the lock, replaces the body
 * with BODY=84, and commits. The final authoritative source and runtime value must be
 * 84. External writers that do not use this lock and multi-CN routing are explicitly
 * outside this fixture's evidence scope.</p>
 */
public final class PackageReplaySerializationFixture {
    private static final String SCHEMA = "dbv_pkg_replay_serial";
    private static final String PACKAGE = "serial_pkg";
    private static final String SPEC = "CREATE PACKAGE " + SCHEMA + "." + PACKAGE
        + " AS FUNCTION value_of RETURN INTEGER; END " + PACKAGE + ";";
    private static final String BODY_42 = "CREATE PACKAGE BODY " + SCHEMA + "." + PACKAGE
        + " AS FUNCTION value_of RETURN INTEGER AS BEGIN RETURN 42; END; END " + PACKAGE + ";";
    private static final String BODY_84 = "CREATE OR REPLACE PACKAGE BODY " + SCHEMA + "." + PACKAGE
        + " AS FUNCTION value_of RETURN INTEGER AS BEGIN RETURN 84; END; END " + PACKAGE + ";";
    private static final long FNV_OFFSET_BASIS = 0xcbf29ce484222325L;
    private static final long FNV_PRIME = 0x100000001b3L;

    private PackageReplaySerializationFixture() {
    }

    public static void main(String[] args) throws Exception {
        if (args.length != 0) throw new IllegalArgumentException("No arguments are accepted");
        Checks checks = new Checks();
        Throwable failure = null;
        boolean schemaCreated = false;
        try (Connection connectionA = GuiPackageFixture.connect();
             Connection connectionB = GuiPackageFixture.connect();
             Connection observer = GuiPackageFixture.connect()) {
            requireAutoCommit(connectionA, "A");
            requireAutoCommit(connectionB, "B");
            requireAutoCommit(observer, "observer");
            execute(connectionA, "CREATE SCHEMA " + SCHEMA);
            schemaCreated = true;
            execute(connectionA, SPEC);
            execute(connectionA, BODY_42);

            long databaseOid = databaseOid(connectionA);
            long schemaOid = schemaOid(connectionA);
            long packageOid = packageOid(connectionA);
            long lockKey = lockKey(databaseOid, schemaOid, SCHEMA, PACKAGE);
            checks.require(packageValue(observer) == 42, "initial committed package returns 42");
            checks.require(databaseOid > 0 && schemaOid > 0 && packageOid > 0,
                "database schema and package identities are available");

            connectionA.setTransactionIsolation(Connection.TRANSACTION_REPEATABLE_READ);
            connectionA.setAutoCommit(false);
            acquireLock(connectionA, lockKey);
            String source42 = sourceByOid(connectionA, packageOid);
            checks.require(containsReturn(source42, 42) && !containsReturn(source42, 84),
                "connection A locked snapshot contains body 42");
            System.out.println("LOCKED packageOid=" + packageOid
                + " key=" + lockKey + " value=42 isolation=REPEATABLE_READ");

            connectionB.setAutoCommit(false);
            boolean bEnteredWhileLocked = tryLock(connectionB, lockKey);
            checks.require(!bEnteredWhileLocked,
                "connection B cannot enter the DBeaver package write section while A holds the lock");
            System.out.println("CONTENDED packageOid=" + packageOid
                + " key=" + lockKey + " secondWriterEntered=" + bEnteredWhileLocked);

            execute(connectionA, GuiPackageFixture.asCreateOrReplace(source42));
            connectionA.commit();
            connectionA.setAutoCommit(true);
            checks.require(packageValue(observer) == 42,
                "connection A replay commits body 42 before the waiting writer");

            acquireLock(connectionB, lockKey);
            checks.require(true, "connection B obtains the same lock after A commits");
            execute(connectionB, BODY_84);
            connectionB.commit();
            connectionB.setAutoCommit(true);
            checks.require(packageValue(connectionB) == 84,
                "connection B commits replacement body 84 after lock handoff");
            System.out.println("HANDOFF packageOid=" + packageOid
                + " key=" + lockKey + " value=84 committed=true");

            checks.require(packageValue(observer) == 84,
                "observer sees connection B value 84 after serialized handoff");
            checks.require(scalarLong(connectionA, "SELECT 1") == 1
                    && scalarLong(connectionB, "SELECT 1") == 1,
                "both writer connections are reusable after commit");
            checks.require(packageOid(connectionA) == packageOid,
                "package identity remains stable after serialized writes");
            String finalSource = sourceByOid(observer, packageOid);
            checks.require(containsReturn(finalSource, 84) && !containsReturn(finalSource, 42),
                "authoritative source remains connection B body 84");
            System.out.println("FINAL packageOid=" + packageOid
                + " value=84 source=connection-B identityStable=true");
            System.out.println("SCOPE cooperativeDBeaverWriters=true externalWriters=false multiCn=false");
        } catch (Throwable unexpected) {
            failure = unexpected;
            if (checks.failed() == 0) checks.fail("unexpected fixture execution");
        } finally {
            if (schemaCreated) {
                try {
                    cleanup();
                    checks.require(true, "isolated schema is cleaned with RESTRICT");
                    System.out.println("CLEANED schema=" + SCHEMA);
                } catch (Throwable cleanupFailure) {
                    checks.fail("isolated schema is cleaned with RESTRICT");
                    if (failure == null) failure = cleanupFailure;
                    else failure.addSuppressed(cleanupFailure);
                }
            }
            checks.finish();
            if (failure == null && checks.failed() != 0) {
                failure = new AssertionError("Package replay serialization checks failed");
            }
        }
        if (failure instanceof Exception) throw (Exception) failure;
        if (failure != null) throw new RuntimeException(failure);
    }

    private static void requireAutoCommit(Connection connection, String name) throws SQLException {
        if (!connection.getAutoCommit()) {
            throw new IllegalStateException("Connection " + name + " must begin in auto-commit mode");
        }
    }

    private static long databaseOid(Connection connection) throws SQLException {
        return scalarLong(connection,
            "SELECT oid FROM pg_catalog.pg_database WHERE datname=current_database()");
    }

    private static long schemaOid(Connection connection) throws SQLException {
        return scalarLong(connection,
            "SELECT oid FROM pg_catalog.pg_namespace WHERE nspname='" + SCHEMA + "'");
    }

    private static long packageOid(Connection connection) throws SQLException {
        String sql = "SELECT p.oid FROM pg_catalog.gs_package p"
            + " JOIN pg_catalog.pg_namespace n ON n.oid=p.pkgnamespace"
            + " WHERE n.nspname=? AND p.pkgname=?";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setQueryTimeout(10);
            statement.setString(1, SCHEMA);
            statement.setString(2, PACKAGE);
            try (ResultSet result = statement.executeQuery()) {
                if (!result.next()) throw new IllegalStateException("Package identity row is absent");
                long oid = result.getLong(1);
                if (result.wasNull() || result.next()) {
                    throw new IllegalStateException("Package identity is not unique");
                }
                return oid;
            }
        }
    }

    private static String sourceByOid(Connection connection, long packageOid) throws SQLException {
        String sql = "SELECT src FROM dbe_pldeveloper.gs_source"
            + " WHERE id=? AND lower(type)='package body'";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setQueryTimeout(10);
            statement.setLong(1, packageOid);
            try (ResultSet result = statement.executeQuery()) {
                if (!result.next()) throw new IllegalStateException("Authoritative package body source is absent");
                String source = result.getString(1);
                if (source == null || result.next()) {
                    throw new IllegalStateException("Authoritative package body source is not unique");
                }
                return source;
            }
        }
    }

    private static void acquireLock(Connection connection, long key) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
            "SELECT pg_catalog.pg_advisory_xact_lock(?)")) {
            statement.setQueryTimeout(10);
            statement.setLong(1, key);
            statement.execute();
        }
    }

    private static boolean tryLock(Connection connection, long key) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
            "SELECT pg_catalog.pg_try_advisory_xact_lock(?)")) {
            statement.setQueryTimeout(10);
            statement.setLong(1, key);
            try (ResultSet result = statement.executeQuery()) {
                if (!result.next()) throw new IllegalStateException("Advisory lock probe returned no row");
                boolean acquired = result.getBoolean(1);
                if (result.wasNull() || result.next()) {
                    throw new IllegalStateException("Advisory lock probe was not unique");
                }
                return acquired;
            }
        }
    }

    private static long lockKey(long databaseOid, long schemaOid, String schemaName, String packageName) {
        long hash = FNV_OFFSET_BASIS;
        hash = update(hash, Long.toString(databaseOid));
        hash = update(hash, Long.toString(schemaOid));
        hash = update(hash, schemaName);
        return update(hash, packageName);
    }

    private static long update(long hash, String value) {
        byte[] bytes = value.getBytes(StandardCharsets.UTF_8);
        hash = mixLong(hash, bytes.length);
        for (byte valueByte : bytes) {
            hash ^= valueByte & 0xffL;
            hash *= FNV_PRIME;
        }
        return hash;
    }

    private static long mixLong(long hash, long value) {
        for (int index = 0; index < Long.BYTES; index++) {
            hash ^= value & 0xffL;
            hash *= FNV_PRIME;
            value >>>= Byte.SIZE;
        }
        return hash;
    }

    private static int packageValue(Connection connection) throws SQLException {
        return (int) scalarLong(connection, "SELECT " + SCHEMA + "." + PACKAGE + ".value_of()");
    }

    private static long scalarLong(Connection connection, String sql) throws SQLException {
        try (java.sql.Statement statement = connection.createStatement()) {
            statement.setQueryTimeout(10);
            try (ResultSet result = statement.executeQuery(sql)) {
                if (!result.next()) throw new IllegalStateException("Scalar query returned no row");
                long value = result.getLong(1);
                if (result.wasNull() || result.next()) throw new IllegalStateException("Scalar query was not unique");
                return value;
            }
        }
    }

    private static void execute(Connection connection, String sql) throws SQLException {
        try (java.sql.Statement statement = connection.createStatement()) {
            statement.setQueryTimeout(20);
            statement.execute(sql);
        }
    }

    private static void cleanup() throws Exception {
        try (Connection connection = GuiPackageFixture.connect()) {
            requireAutoCommit(connection, "cleanup");
            long currentOwner = scalarLong(connection,
                "SELECT oid FROM pg_catalog.pg_roles WHERE rolname=current_user");
            long ownedSchema = scalarLong(connection, "SELECT count(*) FROM pg_catalog.pg_namespace"
                + " WHERE nspname='" + SCHEMA + "' AND nspowner=" + currentOwner);
            long packages = scalarLong(connection, "SELECT count(*) FROM pg_catalog.gs_package p"
                + " JOIN pg_catalog.pg_namespace n ON n.oid=p.pkgnamespace"
                + " WHERE n.nspname='" + SCHEMA + "'");
            long ownedPackage = scalarLong(connection, "SELECT count(*) FROM pg_catalog.gs_package p"
                + " JOIN pg_catalog.pg_namespace n ON n.oid=p.pkgnamespace"
                + " WHERE n.nspname='" + SCHEMA + "' AND p.pkgname='" + PACKAGE + "'"
                + " AND p.pkgowner=" + currentOwner);
            if (ownedSchema != 1 || packages > 1 || (packages == 1 && ownedPackage != 1)) {
                throw new IllegalStateException("Cleanup ownership or package scope check failed");
            }
            connection.setAutoCommit(false);
            try {
                execute(connection, "DROP PACKAGE IF EXISTS " + SCHEMA + "." + PACKAGE);
                execute(connection, "DROP SCHEMA " + SCHEMA + " RESTRICT");
                connection.commit();
            } catch (Throwable cleanupFailure) {
                try {
                    connection.rollback();
                } catch (SQLException rollbackFailure) {
                    cleanupFailure.addSuppressed(rollbackFailure);
                }
                throw cleanupFailure;
            } finally {
                connection.setAutoCommit(true);
            }
            if (scalarLong(connection, "SELECT count(*) FROM pg_catalog.pg_namespace"
                + " WHERE nspname='" + SCHEMA + "'") != 0) {
                throw new IllegalStateException("Isolated schema remains after cleanup");
            }
        }
    }

    private static boolean containsReturn(String source, int value) {
        return source != null && source.matches("(?is).*\\bRETURN\\s+" + value + "\\s*;.*");
    }

    private static final class Checks {
        private int passed;
        private int failed;

        private void require(boolean condition, String label) {
            if (condition) {
                passed++;
                System.out.println("PASS " + label);
            } else {
                fail(label);
            }
        }

        private void fail(String label) {
            failed++;
            System.out.println("FAIL " + label);
        }

        private int failed() {
            return failed;
        }

        private void finish() {
            int total = passed + failed;
            System.out.println("TOTAL CHECKS " + total + " PASS " + passed + " FAIL " + failed);
            if (failed == 0 && total == 12) {
                System.out.println("RESULT PASS test=package-replay-serialization"
                    + " scope=dbeaver-cooperative-advisory-lock gui=false osgi=false"
                    + " externalWriters=false multiCn=false");
            } else {
                System.out.println("RESULT FAIL test=package-replay-serialization"
                    + " scope=dbeaver-cooperative-advisory-lock gui=false osgi=false"
                    + " externalWriters=false multiCn=false");
            }
        }
    }
}
