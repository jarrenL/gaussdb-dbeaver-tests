import java.sql.Connection;
import java.sql.SQLException;

/** Verifies fixture lifecycle and observer assertions; does not substitute JDBC CALL for GUI debugging. */
public class GuiDebugFixtureTest {
    public static void main(String[] args) throws Exception {
        try (Connection c = GuiPackageFixture.connect(); Connection observer = GuiPackageFixture.connect()) {
            for (int round = 0; round < 2; round++) {
                GuiDebugFixture.run(c, "setup");
                try {
                    expect(c, "setup", "42P06");
                    GuiDebugFixture.run(observer, "baseline");
                    c.setAutoCommit(false);
                    try {
                        call(c);
                        GuiDebugFixture.run(observer, "baseline");
                    } finally { c.rollback(); c.setAutoCommit(true); }
                    GuiDebugFixture.run(observer, "baseline");
                    c.setAutoCommit(false);
                    try {
                        call(c);
                        GuiDebugFixture.run(observer, "baseline");
                        c.commit();
                    } finally { c.rollback(); c.setAutoCommit(true); }
                    GuiDebugFixture.run(observer, "committed");
                    GuiPackageFixture.execute(c, "CREATE TABLE " + GuiDebugFixture.SCHEMA + ".guard_table(id integer)");
                    try {
                        GuiPackageFixture.execute(c, "INSERT INTO " + GuiDebugFixture.SCHEMA + ".guard_table VALUES(42)");
                        expect(c, "cleanup", "2BP01");
                        GuiDebugFixture.run(observer, "committed");
                        GuiPackageFixture.check(observer, "SELECT id FROM " + GuiDebugFixture.SCHEMA + ".guard_table", 42);
                        // Prove cleanup rollback also restored the procedure, without persisting a third row.
                        c.setAutoCommit(false);
                        try { call(c); } finally { c.rollback(); c.setAutoCommit(true); }
                    } finally {
                        GuiPackageFixture.execute(c, "DROP TABLE " + GuiDebugFixture.SCHEMA + ".guard_table RESTRICT");
                    }
                } catch (Exception failure) {
                    try { GuiDebugFixture.run(c, "cleanup"); } catch (Exception cleanup) { failure.addSuppressed(cleanup); }
                    throw failure;
                }
                GuiDebugFixture.run(c, "cleanup");
                GuiPackageFixture.check(observer, "SELECT count(*) FROM pg_namespace WHERE nspname='"
                    + GuiDebugFixture.SCHEMA + "'", 0);
            }
            System.out.println("PASS two debug fixture lifecycles, observer transaction assertions and cleanup protection");
        }
    }

    private static void call(Connection c) throws SQLException {
        GuiPackageFixture.execute(c, "CALL " + GuiDebugFixture.SCHEMA + ".write_row(2)");
    }

    private static void expect(Connection c, String action, String state) throws SQLException {
        try { GuiDebugFixture.run(c, action); } catch (SQLException expected) {
            if (!state.equals(expected.getSQLState())) throw expected;
            return;
        }
        throw new IllegalStateException("Expected refusal for " + action);
    }
}
