import java.sql.Connection;
import java.sql.SQLException;

/** Real database fixture protection checks, not package editor/compile UI coverage. */
public class GuiPackageFixtureTest {
    public static void main(String[] args) throws Exception {
        try {
            try (Connection c = GuiPackageFixture.connect()) {
                GuiPackageFixture.PackageCapability capability = GuiPackageFixture.detectCapability(c);
                if (capability.mode() == GuiPackageFixture.PackageMode.UNSUPPORTED) {
                    terminal("UNSUPPORTED", "unsupported-server", capability.mode(), "capability-check");
                    return;
                }
                if (capability.mode() == GuiPackageFixture.PackageMode.STRUCTURED
                    && !"YES".equals(System.getenv(GuiPackageFixture.SESSION_SETTINGS_CONSENT))) {
                    terminal("SKIP", "session-settings-not-authorized", capability.mode(),
                        "required=" + GuiPackageFixture.SESSION_SETTINGS_CONSENT + "=YES");
                    return;
                }
                for (int round = 0; round < 2; round++) {
                    // No cleanup ownership until this exact setup succeeds.
                    GuiPackageFixture.ActionResult setup = GuiPackageFixture.run(c, "setup");
                    if (!setup.isPass()) {
                        terminal(setup.status(), setup.reason(), capability.mode(), setup.details());
                        return;
                    }
                    try {
                        expectDuplicateSetupRefusedWithoutMutation(c);
                        requirePass(GuiPackageFixture.run(c, "verify"));
                        if (capability.mode() == GuiPackageFixture.PackageMode.STRUCTURED) {
                            GuiPackageFixture.check(c, "SELECT count(*) FROM gs_package p JOIN pg_namespace n ON n.oid=p.pkgnamespace"
                                + " JOIN pg_object o ON o.object_oid=p.oid WHERE n.nspname='" + GuiPackageFixture.SCHEMA
                                + "' AND p.pkgname='gui_bad' AND o.object_type='B' AND NOT o.valid", 1);
                        } else {
                            String source = GuiPackageFixture.readInvalidBodySource(c);
                            if (source != null && GuiPackageFixture.lineOf(source, GuiPackageFixture.BAD_TYPE_TOKEN) <= 0) {
                                throw new IllegalStateException("Retained invalid package source line is not inferable");
                            }
                        }
                        GuiPackageFixture.execute(c, "CREATE TABLE " + GuiPackageFixture.SCHEMA + ".guard_table(id integer)");
                        try {
                            GuiPackageFixture.execute(c, "INSERT INTO " + GuiPackageFixture.SCHEMA + ".guard_table VALUES(42)");
                            expect(c, "cleanup", "2BP01");
                            GuiPackageFixture.check(c, "SELECT count(*) FROM " + GuiPackageFixture.SCHEMA
                                + ".guard_table WHERE id=42", 1);
                            requirePass(GuiPackageFixture.run(c, "verify"));
                        } finally {
                            GuiPackageFixture.execute(c, "DROP TABLE " + GuiPackageFixture.SCHEMA + ".guard_table RESTRICT");
                        }
                    } catch (Exception failure) {
                        try { GuiPackageFixture.run(c, "cleanup"); } catch (Exception cleanup) { failure.addSuppressed(cleanup); }
                        throw failure;
                    }
                    GuiPackageFixture.run(c, "cleanup");
                    GuiPackageFixture.check(c, "SELECT count(*) FROM pg_namespace WHERE nspname='"
                        + GuiPackageFixture.SCHEMA + "'", 0);
                }
                requirePass(GuiPackageFixture.run(c, "setup"));
                try {
                    // Simulate objects already removed by a completed GUI deletion.
                    GuiPackageFixture.execute(c, "DROP PACKAGE " + GuiPackageFixture.SCHEMA + ".gui_bad");
                    GuiPackageFixture.execute(c, "DROP PACKAGE " + GuiPackageFixture.SCHEMA + ".gui_valid");
                } finally {
                    GuiPackageFixture.run(c, "cleanup");
                }
                GuiPackageFixture.check(c, "SELECT count(*) FROM pg_namespace WHERE nspname='"
                    + GuiPackageFixture.SCHEMA + "'", 0);
                terminal("PASS", "none", capability.mode(),
                    "two-guarded-lifecycles,diagnostics,duplicate-refusal-without-mutation,"
                        + "unrelated-table-retained,failed-cleanup-restores-packages,"
                        + "cleanup-after-package-removal");
            }
        } catch (Exception failure) {
            System.out.println("RESULT FAIL test=package-fixture reason=exception mode=unknown details="
                + String.valueOf(failure.getMessage()).replaceAll("\\s+", " ").trim());
            throw failure;
        }
    }

    private static void expectDuplicateSetupRefusedWithoutMutation(Connection c) throws SQLException {
        FixtureState before = snapshot(c);
        SQLException refusal = null;
        try {
            GuiPackageFixture.ActionResult duplicate = GuiPackageFixture.run(c, "setup");
            if (!duplicate.isPass()) {
                throw new IllegalStateException("Duplicate setup returned " + duplicate.status()
                    + " instead of a transactional refusal");
            }
        } catch (SQLException expected) {
            refusal = expected;
        }
        if (refusal == null) throw new IllegalStateException("Duplicate setup unexpectedly succeeded");
        if (!c.getAutoCommit()) throw new IllegalStateException("Duplicate setup left auto-commit disabled");
        FixtureState after = snapshot(c);
        if (!before.equals(after)) {
            throw new IllegalStateException("Duplicate setup changed the owned fixture state");
        }
        System.out.println("DUPLICATE REFUSED sqlState="
            + (refusal.getSQLState() == null ? "none" : refusal.getSQLState())
            + " originalStatePreserved=true transactionRolledBack=true");
    }

    private static void expect(Connection c, String action, String state) throws SQLException {
        try {
            GuiPackageFixture.run(c, action);
        } catch (SQLException expected) {
            if (!state.equals(expected.getSQLState())) throw expected;
            return;
        }
        throw new IllegalStateException("Expected SQL refusal for " + action);
    }

    private static FixtureState snapshot(Connection c) throws SQLException {
        return new FixtureState(
            singleLong(c, "SELECT oid FROM pg_namespace WHERE nspname='" + GuiPackageFixture.SCHEMA + "'"),
            singleLong(c, "SELECT p.oid FROM gs_package p JOIN pg_namespace n ON n.oid=p.pkgnamespace"
                + " WHERE n.nspname='" + GuiPackageFixture.SCHEMA + "' AND p.pkgname='gui_valid'"),
            singleLong(c, "SELECT p.oid FROM gs_package p JOIN pg_namespace n ON n.oid=p.pkgnamespace"
                + " WHERE n.nspname='" + GuiPackageFixture.SCHEMA + "' AND p.pkgname='gui_bad'"),
            singleLong(c, "SELECT " + GuiPackageFixture.SCHEMA + ".gui_valid.value_of()"),
            GuiPackageFixture.readInvalidBodySource(c)
        );
    }

    private static long singleLong(Connection c, String sql) throws SQLException {
        try (var statement = c.createStatement()) {
            statement.setQueryTimeout(10);
            try (var rows = statement.executeQuery(sql)) {
                if (!rows.next()) throw new IllegalStateException("Fixture state query returned no row");
                long value = rows.getLong(1);
                if (rows.wasNull() || rows.next()) {
                    throw new IllegalStateException("Fixture state query returned null or multiple rows");
                }
                return value;
            }
        }
    }

    private static void terminal(
        String status,
        String reason,
        GuiPackageFixture.PackageMode mode,
        String details
    ) {
        System.out.println("RESULT " + status + " test=package-fixture reason=" + reason
            + " mode=" + mode.externalName() + " details=" + details);
    }

    private static void requirePass(GuiPackageFixture.ActionResult result) {
        if (!result.isPass()) {
            throw new IllegalStateException("Required fixture action was " + result.status()
                + ": " + result.test() + " " + result.reason());
        }
    }

    private record FixtureState(
        long schemaOid,
        long validPackageOid,
        long invalidPackageOid,
        long validResult,
        String invalidSource
    ) {}
}
