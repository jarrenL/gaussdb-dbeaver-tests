import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.Properties;

/** Disposable package fixture; SQL is fixed and cleanup never uses schema CASCADE. */
public class GuiPackageFixture {
    static final String SCHEMA = "dbv_pkg_gui_repeatable";

    public static void main(String[] args) throws Exception {
        if (args.length != 1 || !java.util.Set.of("setup", "verify", "cleanup").contains(args[0])) {
            throw new IllegalArgumentException("Usage: GuiPackageFixture setup|verify|cleanup");
        }
        try (Connection c = connect()) {
            run(c, args[0]);
        }
    }

    static Connection connect() throws Exception {
        if (!"YES".equals(System.getenv("GAUSSDB_HISTORY_ALLOW_DDL"))) {
            throw new IllegalArgumentException("Explicit GAUSSDB_HISTORY_ALLOW_DDL=YES required");
        }
        String url = required("GAUSSDB_PACKAGE_URL");
        if (!url.startsWith("jdbc:gaussdb:")) throw new IllegalArgumentException("GaussDB JDBC URL required");
        Properties p = new Properties();
        p.setProperty("user", required("GAUSSDB_PACKAGE_USER"));
        p.setProperty("password", Files.readString(Path.of(required("GAUSSDB_PACKAGE_PASSWORD_FILE"))).strip());
        p.setProperty("connectTimeout", "10");
        p.setProperty("socketTimeout", "20");
        Class.forName(required("GAUSSDB_PACKAGE_DRIVER"));
        return DriverManager.getConnection(url, p);
    }

    static void run(Connection c, String action) throws SQLException {
        if (!c.getAutoCommit()) throw new IllegalStateException("Dedicated auto-commit connection required");
        if (action.equals("verify")) {
            owned(c);
            check(c, "SELECT count(*) FROM gs_package p JOIN pg_namespace n ON n.oid=p.pkgnamespace"
                + " WHERE n.nspname='" + SCHEMA + "' AND p.pkgname IN ('gui_valid','gui_bad')", 2);
            check(c, "SELECT " + SCHEMA + ".gui_valid.value_of()", 42);
            System.out.println("VERIFIED package count and normal package result");
            return;
        }
        if (!action.equals("setup") && !action.equals("cleanup")) throw new IllegalArgumentException("Unknown action");
        c.setAutoCommit(false);
        try {
            if (action.equals("setup")) {
                // No IF NOT EXISTS: never adopt a pre-existing schema.
                execute(c, "CREATE SCHEMA " + SCHEMA);
                execute(c, "SET LOCAL enable_force_create_obj=on");
                execute(c, "SET LOCAL plsql_show_all_error=off");
                for (String name : new String[]{"gui_valid", "gui_bad"}) {
                    execute(c, "CREATE PACKAGE " + SCHEMA + "." + name
                        + " AS FUNCTION value_of RETURN INTEGER; END " + name + ";");
                    execute(c, "CREATE PACKAGE BODY " + SCHEMA + "." + name
                        + " AS FUNCTION value_of RETURN INTEGER AS "
                        + (name.equals("gui_bad") ? "missing " + SCHEMA + ".no_such_table.id%TYPE; " : "")
                        + "BEGIN RETURN 42; END; END " + name + ";");
                }
            } else {
                owned(c);
                // GUI deletion may already have removed these two packages.
                execute(c, "DROP PACKAGE IF EXISTS " + SCHEMA + ".gui_bad");
                execute(c, "DROP PACKAGE IF EXISTS " + SCHEMA + ".gui_valid");
                execute(c, "DROP SCHEMA " + SCHEMA + " RESTRICT");
            }
            c.commit();
        } catch (Exception failure) {
            try { c.rollback(); } catch (SQLException rollback) { failure.addSuppressed(rollback); }
            throw failure;
        } finally {
            c.setAutoCommit(true);
        }
        System.out.println(action.equals("setup") ? "CREATED package fixture" : "CLEANED package fixture");
    }

    private static void owned(Connection c) throws SQLException {
        check(c, "SELECT count(*) FROM pg_namespace WHERE nspname='" + SCHEMA
            + "' AND nspowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)", 1);
    }

    static void execute(Connection c, String sql) throws SQLException {
        try (var s = c.createStatement()) { s.setQueryTimeout(10); s.execute(sql); }
    }

    static void check(Connection c, String sql, int expected) throws SQLException {
        try (var s = c.createStatement()) {
            s.setQueryTimeout(10);
            try (var r = s.executeQuery(sql)) {
                if (!r.next() || r.getInt(1) != expected) throw new IllegalStateException("Fixture assertion failed");
            }
        }
    }

    private static String required(String key) {
        String value = System.getenv(key);
        if (value == null || value.isBlank()) throw new IllegalArgumentException("Missing " + key);
        return value;
    }
}
