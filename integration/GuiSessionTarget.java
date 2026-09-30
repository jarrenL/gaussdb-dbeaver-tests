import java.nio.file.*;
import java.sql.*;
import java.util.Properties;

/** A dedicated read-only connection for external GUI cancel/terminate acceptance. */
public class GuiSessionTarget {
    public static void main(String[] args) throws Exception {
        if (args.length != 3 || !args[1].matches("cancel|terminate")
            || !args[2].matches("dbv_gui_[a-z0-9_]+")) {
            throw new IllegalArgumentException("config, cancel|terminate, unique dbv_gui_ marker required");
        }
        Properties properties = new Properties();
        try (var input = Files.newInputStream(Path.of(args[0]))) { properties.load(input); }
        Class.forName(properties.getProperty("driverClass", "com.huawei.gauss200.jdbc.Driver"));
        String url = properties.getProperty("url");
        properties.setProperty("ApplicationName", args[2]);
        properties.setProperty("socketTimeout", "150");
        properties.setProperty("connectTimeout", "10");
        try (Connection connection = DriverManager.getConnection(url, properties)) {
            try (Statement statement = connection.createStatement();
                 ResultSet rows = statement.executeQuery("SELECT pg_backend_pid(),current_user")) {
                if (!rows.next()) throw new AssertionError("Missing target identity");
                System.out.println("TARGET " + args[2] + " PID=" + rows.getLong(1) + " USER=" + rows.getString(2));
            }
            try (Statement statement = connection.createStatement()) {
                statement.execute("SELECT pg_sleep(120)");
                throw new AssertionError("GUI action did not interrupt target query");
            } catch (SQLException failure) {
                String state = failure.getSQLState();
                System.out.println("INTERRUPTED SQLSTATE=" + state);
                if (args[1].equals("cancel")) {
                    if (!"57014".equals(state)) throw new AssertionError("Expected cancellation", failure);
                    try (Statement statement = connection.createStatement(); ResultSet rows = statement.executeQuery("SELECT 42")) {
                        if (!rows.next() || rows.getInt(1) != 42) throw new AssertionError("Connection not reusable");
                    }
                    System.out.println("PASS cancel: same connection still queries");
                } else {
                    if (state == null || !(state.startsWith("08") || state.equals("57P01"))) {
                        throw new AssertionError("Expected terminated connection", failure);
                    }
                    if (connection.isValid(2)) throw new AssertionError("Terminated connection remains valid");
                    try (Connection fresh = DriverManager.getConnection(url, properties);
                         Statement statement = fresh.createStatement(); ResultSet rows = statement.executeQuery("SELECT 42")) {
                        if (!rows.next() || rows.getInt(1) != 42) throw new AssertionError("Fresh connection failed");
                    }
                    System.out.println("PASS terminate: old invalid, fresh connection queries");
                }
            }
        }
    }
}
