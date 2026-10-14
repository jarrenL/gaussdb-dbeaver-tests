import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.HexFormat;

/**
 * Repeatable server/JDBC fixture for the distributed-package source refresh contract.
 *
 * <p>Connection A deliberately retains an old Java String after connection B replaces the
 * package body. A must then query GS_SOURCE again by the original package OID and replay only
 * that refreshed value. This is catalog/replay evidence, not a DBeaver UI or OSGi invocation.
 */
public final class PackageCatalogConcurrencyFixture {
    private static final String SCHEMA = "dbv_pkg_catalog_refresh";
    private static final String PACKAGE = "refresh_pkg";
    private static final String SPEC = "CREATE PACKAGE " + SCHEMA + "." + PACKAGE
        + " AS FUNCTION value_of RETURN INTEGER; END " + PACKAGE + ";";
    private static final String BODY_42 = "CREATE PACKAGE BODY " + SCHEMA + "." + PACKAGE
        + " AS FUNCTION value_of RETURN INTEGER AS BEGIN RETURN 42; END; END " + PACKAGE + ";";
    private static final String BODY_84 = "CREATE OR REPLACE PACKAGE BODY " + SCHEMA + "." + PACKAGE
        + " AS FUNCTION value_of RETURN INTEGER AS BEGIN RETURN 84; END; END " + PACKAGE + ";";

    private PackageCatalogConcurrencyFixture() {
    }

    public static void main(String[] args) throws Exception {
        if (args.length != 0) throw new IllegalArgumentException("No arguments are accepted");
        Checks checks = new Checks();
        Throwable failure = null;
        boolean schemaCreated = false;
        try (Connection connectionA = GuiPackageFixture.connect();
             Connection connectionB = GuiPackageFixture.connect()) {
            requireAutoCommit(connectionA, "A");
            requireAutoCommit(connectionB, "B");
            execute(connectionA, "CREATE SCHEMA " + SCHEMA);
            schemaCreated = true;
            execute(connectionA, SPEC);
            execute(connectionA, BODY_42);

            Snapshot initial = snapshot(connectionA);
            long currentOwner = scalarLong(connectionA,
                "SELECT oid FROM pg_catalog.pg_roles WHERE rolname=current_user");
            checks.require(initial.schemaOwner() == currentOwner && initial.packageOwner() == currentOwner,
                "isolated schema and package are owned by the test account");

            int initialValue = packageValue(connectionA);
            checks.require(initialValue == 42, "initial package invocation returns 42");
            Source oldSource = sourceByOid(connectionA, initial.packageOid());
            checks.require(oldSource.valid() && containsReturn(oldSource.sql(), 42)
                    && !containsReturn(oldSource.sql(), 84),
                "connection A cached the old authoritative body by OID");
            System.out.println("SOURCE OLD packageOid=" + initial.packageOid()
                + " digest=" + digest(oldSource.sql()) + " value=42");

            execute(connectionB, BODY_84);
            int updatedValue = packageValue(connectionB);
            checks.require(updatedValue == 84, "connection B replacement returns 84");
            System.out.println("CONCURRENT UPDATE packageOid=" + initial.packageOid()
                + " value=84 connection=B");

            Snapshot afterUpdate = snapshot(connectionA);
            Source refreshedSource = sourceByOid(connectionA, initial.packageOid());
            checks.require(refreshedSource.valid() && containsReturn(refreshedSource.sql(), 84)
                    && !containsReturn(refreshedSource.sql(), 42),
                "connection A refreshed the authoritative body by the same OID");
            String oldDigest = digest(oldSource.sql());
            String refreshedDigest = digest(refreshedSource.sql());
            checks.require(!oldDigest.equals(refreshedDigest),
                "refreshed source differs from the stale cache");

            String replaySource = refreshedSource.sql();
            boolean staleSelected = replaySource.equals(oldSource.sql());
            checks.require(!staleSelected && replaySource.equals(refreshedSource.sql()),
                "replay selected only the refreshed source");
            System.out.println("SOURCE REFRESH packageOid=" + initial.packageOid()
                + " digest=" + refreshedDigest + " value=84 staleSelected=" + staleSelected);

            // Use the same CREATE -> CREATE OR REPLACE normalization contract as the product fixture.
            execute(connectionA, GuiPackageFixture.asCreateOrReplace(replaySource));
            int replayedValue = packageValue(connectionA);
            checks.require(replayedValue == 84, "authoritative replay preserves value 84");
            System.out.println("REPLAY packageOid=" + initial.packageOid()
                + " source=refreshed value=" + replayedValue);

            Snapshot afterReplay = snapshot(connectionA);
            boolean schemaStable = initial.schemaOid() == afterUpdate.schemaOid()
                && initial.schemaOid() == afterReplay.schemaOid();
            boolean schemaOwnerStable = initial.schemaOwner() == afterUpdate.schemaOwner()
                && initial.schemaOwner() == afterReplay.schemaOwner();
            boolean packageStable = initial.packageOid() == afterUpdate.packageOid()
                && initial.packageOid() == afterReplay.packageOid();
            boolean packageOwnerStable = initial.packageOwner() == afterUpdate.packageOwner()
                && initial.packageOwner() == afterReplay.packageOwner();
            boolean specStable = sameValidObject(initial.spec(), afterUpdate.spec(), afterReplay.spec());
            boolean bodyStable = sameValidObject(initial.body(), afterUpdate.body(), afterReplay.body());
            checks.require(schemaStable && schemaOwnerStable,
                "schema identity and owner remain stable");
            checks.require(packageStable && packageOwnerStable,
                "package identity and owner remain stable");
            checks.require(specStable,
                "specification object identity and valid state remain stable");
            checks.require(bodyStable,
                "body object identity and valid state remain stable");
            System.out.println("IDENTITY schemaOid=" + initial.schemaOid()
                + " schemaOwner=" + initial.schemaOwner()
                + " packageOid=" + initial.packageOid()
                + " packageOwner=" + initial.packageOwner()
                + " specObjectOid=" + initial.spec().objectOid()
                + " bodyObjectOid=" + initial.body().objectOid()
                + " schemaStable=" + schemaStable
                + " ownerStable=" + (schemaOwnerStable && packageOwnerStable)
                + " packageStable=" + packageStable
                + " specStable=" + specStable
                + " bodyStable=" + bodyStable
                + " specValid=" + afterReplay.spec().valid()
                + " bodyValid=" + afterReplay.body().valid());
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
        }
        if (failure instanceof Exception exception) throw exception;
        if (failure != null) throw new RuntimeException(failure);
    }

    private static void requireAutoCommit(Connection connection, String name) throws SQLException {
        if (!connection.getAutoCommit()) {
            throw new IllegalStateException("Connection " + name + " must use statement-level snapshots");
        }
    }

    private static Snapshot snapshot(Connection connection) throws SQLException {
        String sql = "SELECT n.oid,n.nspowner,p.oid,p.pkgowner"
            + " FROM pg_catalog.gs_package p"
            + " JOIN pg_catalog.pg_namespace n ON n.oid=p.pkgnamespace"
            + " WHERE n.nspname=? AND p.pkgname=?";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setQueryTimeout(10);
            statement.setString(1, SCHEMA);
            statement.setString(2, PACKAGE);
            try (ResultSet result = statement.executeQuery()) {
                if (!result.next()) throw new IllegalStateException("Package identity row is absent");
                Snapshot snapshot = new Snapshot(result.getLong(1), result.getLong(2),
                    result.getLong(3), result.getLong(4), null, null);
                if (result.next()) throw new IllegalStateException("Package identity is not unique");
                return new Snapshot(snapshot.schemaOid(), snapshot.schemaOwner(),
                    snapshot.packageOid(), snapshot.packageOwner(),
                    objectState(connection, snapshot.packageOid(), "S"),
                    objectState(connection, snapshot.packageOid(), "B"));
            }
        }
    }

    private static ObjectState objectState(Connection connection, long packageOid, String type)
        throws SQLException {
        String sql = "SELECT object_oid,valid FROM pg_catalog.pg_object"
            + " WHERE object_oid=? AND object_type=?";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setQueryTimeout(10);
            statement.setLong(1, packageOid);
            statement.setString(2, type);
            try (ResultSet result = statement.executeQuery()) {
                if (!result.next()) throw new IllegalStateException("Missing pg_object state for " + type);
                ObjectState state = new ObjectState(result.getLong(1), result.getBoolean(2));
                if (result.next()) throw new IllegalStateException("Duplicate pg_object state for " + type);
                return state;
            }
        }
    }

    private static Source sourceByOid(Connection connection, long packageOid) throws SQLException {
        String sql = "SELECT src,status FROM dbe_pldeveloper.gs_source"
            + " WHERE id=? AND lower(type)='package body'";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setQueryTimeout(10);
            statement.setLong(1, packageOid);
            try (ResultSet result = statement.executeQuery()) {
                if (!result.next()) throw new IllegalStateException("Authoritative package body source is absent");
                Source source = new Source(result.getString(1), result.getBoolean(2));
                if (result.next()) throw new IllegalStateException("Authoritative package body source is not unique");
                return source;
            }
        }
    }

    private static int packageValue(Connection connection) throws SQLException {
        return (int) scalarLong(connection, "SELECT " + SCHEMA + "." + PACKAGE + ".value_of()");
    }

    private static long scalarLong(Connection connection, String sql) throws SQLException {
        try (var statement = connection.createStatement()) {
            statement.setQueryTimeout(10);
            try (var result = statement.executeQuery(sql)) {
                if (!result.next()) throw new IllegalStateException("Scalar query returned no row");
                long value = result.getLong(1);
                if (result.wasNull() || result.next()) throw new IllegalStateException("Scalar query was not unique");
                return value;
            }
        }
    }

    private static void execute(Connection connection, String sql) throws SQLException {
        try (var statement = connection.createStatement()) {
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
            } catch (Throwable failure) {
                try {
                    connection.rollback();
                } catch (SQLException rollbackFailure) {
                    failure.addSuppressed(rollbackFailure);
                }
                throw failure;
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

    private static boolean sameValidObject(ObjectState first, ObjectState second, ObjectState third) {
        return first.valid() && second.valid() && third.valid()
            && first.objectOid() == second.objectOid() && first.objectOid() == third.objectOid();
    }

    private static String digest(String source) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
            .digest(source.getBytes(StandardCharsets.UTF_8)));
    }

    private record Source(String sql, boolean valid) {
    }

    private record ObjectState(long objectOid, boolean valid) {
    }

    private record Snapshot(long schemaOid, long schemaOwner, long packageOid, long packageOwner,
                            ObjectState spec, ObjectState body) {
    }

    private static final class Checks {
        private int passed;
        private int failed;

        void require(boolean condition, String label) {
            if (!condition) {
                fail(label);
                throw new IllegalStateException(label);
            }
            passed++;
            System.out.println("PASS " + label);
        }

        void fail(String label) {
            failed++;
            System.out.println("FAIL " + label);
        }

        int failed() {
            return failed;
        }

        void finish() {
            int total = passed + failed;
            System.out.println("TOTAL CHECKS " + total + " PASS " + passed + " FAIL " + failed);
            System.out.println("RESULT " + (failed == 0 ? "PASS" : "FAIL")
                + " test=package-catalog-concurrency scope=server-jdbc-catalog gui=false osgi=false");
        }
    }
}
