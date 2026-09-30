import java.sql.Connection;
import java.sql.SQLException;

/** Real database fixture protection checks, not package editor/compile UI coverage. */
public class GuiPackageFixtureTest {
    public static void main(String[] args) throws Exception {
        try (Connection c = GuiPackageFixture.connect()) {
            for (int round = 0; round < 2; round++) {
                // No cleanup ownership until this exact setup succeeds.
                GuiPackageFixture.run(c, "setup");
                try {
                    expect(c, "setup", "42P06");
                    GuiPackageFixture.run(c, "verify");
                    GuiPackageFixture.check(c, "SELECT count(*) FROM gs_package p JOIN pg_namespace n ON n.oid=p.pkgnamespace"
                        + " JOIN pg_object o ON o.object_oid=p.oid WHERE n.nspname='" + GuiPackageFixture.SCHEMA
                        + "' AND p.pkgname='gui_bad' AND o.object_type='B' AND NOT o.valid", 1);
                    GuiPackageFixture.execute(c, "CREATE TABLE " + GuiPackageFixture.SCHEMA + ".guard_table(id integer)");
                    try {
                        GuiPackageFixture.execute(c, "INSERT INTO " + GuiPackageFixture.SCHEMA + ".guard_table VALUES(42)");
                        expect(c, "cleanup", "2BP01");
                        GuiPackageFixture.check(c, "SELECT count(*) FROM " + GuiPackageFixture.SCHEMA
                            + ".guard_table WHERE id=42", 1);
                        GuiPackageFixture.run(c, "verify");
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
            GuiPackageFixture.run(c, "setup");
            try {
                // Simulate objects already removed by a completed GUI deletion.
                GuiPackageFixture.execute(c, "DROP PACKAGE " + GuiPackageFixture.SCHEMA + ".gui_bad");
                GuiPackageFixture.execute(c, "DROP PACKAGE " + GuiPackageFixture.SCHEMA + ".gui_valid");
            } finally {
                GuiPackageFixture.run(c, "cleanup");
            }
            GuiPackageFixture.check(c, "SELECT count(*) FROM pg_namespace WHERE nspname='"
                + GuiPackageFixture.SCHEMA + "'", 0);
            System.out.println("PASS two guarded lifecycles; invalid body; duplicate refusal; unrelated table retained;"
                + " failed cleanup restores packages; cleanup after packages already removed");
        }
    }

    private static void expect(Connection c, String action, String state) throws SQLException {
        try { GuiPackageFixture.run(c, action); } catch (SQLException expected) {
            if (!state.equals(expected.getSQLState())) throw expected;
            return;
        }
        throw new IllegalStateException("Expected SQL refusal for " + action);
    }
}
