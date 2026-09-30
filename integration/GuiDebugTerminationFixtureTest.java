import java.nio.file.*;
import java.sql.*;
import java.util.*;

/** Real-database lifecycle checks, not debugger GUI coverage. Explicit DDL opt-in required. */
public class GuiDebugTerminationFixtureTest {
    public static void main(String[] args) throws Exception {
        if (args.length != 2 || !"YES".equals(System.getenv("GAUSSDB_HISTORY_ALLOW_DDL"))) {
            throw new IllegalArgumentException("Usage: protected-config fixture.sql; explicit DDL consent required");
        }
        Properties p = new Properties();
        try (var in = Files.newInputStream(Path.of(args[0]))) { p.load(in); }
        Class.forName(p.getProperty("driverClass", "com.huawei.gauss200.jdbc.Driver"));
        p.setProperty("connectTimeout", "10");
        p.setProperty("socketTimeout", "20");
        try (Connection c = DriverManager.getConnection(p.getProperty("url"), p)) {
            // Do not enter the cleanup block unless this invocation created the schema.
            run(args, "setup");
            try {
                expectSqlFailure(args, "setup", "42P06");
                run(args, "verify");
                exec(c, "CREATE TABLE dbv_gui_f10_fixture.unrelated_guard(id integer)");
                try {
                    exec(c, "INSERT INTO dbv_gui_f10_fixture.unrelated_guard VALUES (42)");
                    expectSqlFailure(args, "cleanup", "2BP01");
                    check(c, "SELECT count(*) FROM dbv_gui_f10_fixture.unrelated_guard WHERE id=42", 1);
                    check(c, "SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='dbv_gui_f10_fixture' AND p.proname='write_then_wait'", 1);
                    run(args, "verify");
                } finally {
                    exec(c, "DROP TABLE dbv_gui_f10_fixture.unrelated_guard RESTRICT");
                }
            } catch (Exception failure) {
                try { run(args, "cleanup"); } catch (Exception cleanup) { failure.addSuppressed(cleanup); }
                throw failure;
            }
            run(args, "cleanup");
            check(c, "SELECT count(*) FROM pg_namespace WHERE nspname='dbv_gui_f10_fixture'", 0);
            run(args, "setup");
            run(args, "cleanup");
            check(c, "SELECT count(*) FROM pg_namespace WHERE nspname='dbv_gui_f10_fixture'", 0);
            System.out.println("PASS duplicate refusal; unrelated object retained; failed cleanup rolled back; two clean lifecycles");
        }
    }
    private static void run(String[] a, String action) throws Exception {
        GuiDebugTerminationFixture.main(new String[]{a[0], action, a[1]});
    }
    private static void expectSqlFailure(String[] a, String action, String state) throws Exception {
        try { run(a, action); } catch (SQLException expected) {
            if (!state.equals(expected.getSQLState())) throw expected;
            return;
        }
        throw new IllegalStateException("Expected SQL refusal: " + action);
    }
    private static void exec(Connection c, String sql) throws SQLException {
        try (var s = c.createStatement()) { s.setQueryTimeout(10); s.execute(sql); }
    }
    private static void check(Connection c, String sql, int expected) throws SQLException {
        try (var s = c.createStatement()) {
            s.setQueryTimeout(10);
            try (var r = s.executeQuery(sql)) {
                if (!r.next() || r.getInt(1) != expected) throw new IllegalStateException("Fixture preservation assertion failed");
            }
        }
    }
}
