import java.sql.Connection;
import java.sql.SQLException;

/** Fixed, ordinary-account fixture for repeatable GUI debug transaction acceptance. */
public class GuiDebugFixture {
    static final String SCHEMA = "dbv_debug_gui_repeatable";

    public static void main(String[] args) throws Exception {
        if (args.length != 1) throw new IllegalArgumentException("setup|baseline|committed|cleanup required");
        try (Connection c = GuiPackageFixture.connect()) { run(c, args[0]); }
    }

    static void run(Connection c, String action) throws SQLException {
        if (!c.getAutoCommit()) throw new IllegalStateException("Dedicated auto-commit connection required");
        if (action.equals("baseline") || action.equals("committed")) {
            owned(c);
            int count = action.equals("baseline") ? 1 : 2;
            GuiPackageFixture.check(c, "SELECT count(*) FROM " + SCHEMA + ".audit", count);
            GuiPackageFixture.check(c, "SELECT count(*) FROM " + SCHEMA + ".audit WHERE id=1", 1);
            GuiPackageFixture.check(c, "SELECT count(*) FROM " + SCHEMA + ".audit WHERE id=12", count - 1);
            System.out.println("VERIFIED " + action);
            return;
        }
        if (!action.equals("setup") && !action.equals("cleanup")) throw new IllegalArgumentException("Unknown action");
        c.setAutoCommit(false);
        try {
            if (action.equals("setup")) {
                // Deliberately refuse existing schemas; no adopting previous or unrelated work.
                sql(c, "CREATE SCHEMA " + SCHEMA);
                sql(c, "CREATE TABLE " + SCHEMA + ".audit(id integer)");
                sql(c, "INSERT INTO " + SCHEMA + ".audit VALUES(1)");
                sql(c, "CREATE PROCEDURE " + SCHEMA + ".write_row(p_id integer) AS DECLARE\n"
                    + "v_value integer := 10;\nBEGIN\nv_value := v_value + p_id;\n"
                    + "INSERT INTO " + SCHEMA + ".audit VALUES(v_value);\nEND;");
            } else {
                owned(c);
                sql(c, "DROP PROCEDURE " + SCHEMA + ".write_row(integer) RESTRICT");
                sql(c, "DROP TABLE " + SCHEMA + ".audit RESTRICT");
                sql(c, "DROP SCHEMA " + SCHEMA + " RESTRICT");
            }
            c.commit();
        } catch (Exception failure) {
            try { c.rollback(); } catch (SQLException rollback) { failure.addSuppressed(rollback); }
            throw failure;
        } finally { c.setAutoCommit(true); }
        System.out.println("COMPLETED " + action);
    }

    private static void owned(Connection c) throws SQLException {
        GuiPackageFixture.check(c, "SELECT count(*) FROM pg_namespace WHERE nspname='" + SCHEMA
            + "' AND nspowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)", 1);
    }

    private static void sql(Connection c, String sql) throws SQLException { GuiPackageFixture.execute(c, sql); }
}
