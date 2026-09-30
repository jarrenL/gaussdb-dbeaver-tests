import java.nio.file.*;
import java.sql.*;
import java.util.*;

/** Isolated GUI termination fixture: a committed baseline and an uncommitted insert. */
public class GuiTransactionTarget {
    static void execute(Connection c, String sql) throws SQLException {
        try (Statement s = c.createStatement()) { s.setQueryTimeout(15); s.execute(sql); }
    }
    static long scalar(Connection c, String sql) throws SQLException {
        try (Statement s = c.createStatement()) {
            s.setQueryTimeout(15);
            try (ResultSet r = s.executeQuery(sql)) {
                if (!r.next()) throw new AssertionError("Missing result");
                return r.getLong(1);
            }
        }
    }
    public static void main(String[] args) throws Exception {
        if (args.length != 2 || !args[1].matches("dbv_gui_[a-z0-9_]+")
            || !"YES".equals(System.getenv("GAUSSDB_HISTORY_ALLOW_DDL"))) {
            throw new IllegalArgumentException("Protected config, unique marker and explicit isolated DDL consent required");
        }
        Properties p = new Properties();
        try (var in = Files.newInputStream(Path.of(args[0]))) { p.load(in); }
        Class.forName(p.getProperty("driverClass", "com.huawei.gauss200.jdbc.Driver"));
        String url = p.getProperty("url");
        p.setProperty("socketTimeout", "150"); p.setProperty("connectTimeout", "10");
        p.setProperty("ApplicationName", args[1] + "_observer");
        String schema = "dbv_gui_tx_" + UUID.randomUUID().toString().replace("-", "");
        try (Connection observer = DriverManager.getConnection(url, p)) {
            execute(observer, "CREATE SCHEMA " + schema);
            Throwable primary = null;
            try {
                execute(observer, "CREATE TABLE " + schema + ".audit(id integer)");
                execute(observer, "INSERT INTO " + schema + ".audit VALUES(1)");
                p.setProperty("ApplicationName", args[1]);
                try (Connection target = DriverManager.getConnection(url, p)) {
                    target.setAutoCommit(false);
                    execute(target, "INSERT INTO " + schema + ".audit VALUES(2)");
                    if (scalar(target, "SELECT count(*) FROM " + schema + ".audit") != 2
                        || scalar(observer, "SELECT count(*) FROM " + schema + ".audit") != 1) {
                        throw new AssertionError("Uncommitted fixture visibility is incorrect");
                    }
                    System.out.println("TARGET " + args[1] + " PID=" + scalar(target, "SELECT pg_backend_pid()"));
                    System.out.println("BEFORE targetRows=2 observerRows=1 schema=" + schema);
                    try (Statement s = target.createStatement()) {
                        s.execute("SELECT pg_sleep(120)");
                        throw new AssertionError("GUI did not terminate target");
                    } catch (SQLException failure) {
                        String state = failure.getSQLState();
                        if (state == null || !(state.equals("57P01") || state.startsWith("08"))) throw failure;
                        System.out.println("INTERRUPTED SQLSTATE=" + state);
                        if (target.isValid(2)) throw new AssertionError("Target still valid");
                    }
                }
                if (scalar(observer, "SELECT count(*) FROM " + schema + ".audit") != 1
                    || scalar(observer, "SELECT count(*) FROM " + schema + ".audit WHERE id=2") != 0) {
                    throw new AssertionError("Uncommitted row survived termination");
                }
                try (Connection fresh = DriverManager.getConnection(url, p)) {
                    execute(fresh, "INSERT INTO " + schema + ".audit VALUES(3)");
                }
                if (scalar(observer, "SELECT count(*) FROM " + schema + ".audit") != 2) {
                    throw new AssertionError("Fresh committed write failed");
                }
                System.out.println("PASS terminate transaction: baseline kept, uncommitted row absent, fresh write committed");
            } catch (Exception | AssertionError failure) {
                primary = failure;
                throw failure;
            } finally {
                try {
                    execute(observer, "DROP SCHEMA " + schema + " CASCADE");
                    System.out.println("CLEANED " + schema);
                } catch (SQLException cleanup) {
                    if (primary == null) throw cleanup;
                    primary.addSuppressed(cleanup);
                }
            }
        }
    }
}
