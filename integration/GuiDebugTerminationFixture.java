import java.nio.file.*;
import java.sql.*;
import java.util.*;

/** Fixed, opt-in disposable fixture. Never accepts an arbitrary schema to drop. */
public class GuiDebugTerminationFixture {
    private static final String SCHEMA = "dbv_gui_f10_fixture";
    public static void main(String[] args) throws Exception {
        if (args.length != 3 || !"YES".equals(System.getenv("GAUSSDB_HISTORY_ALLOW_DDL"))) {
            throw new IllegalArgumentException("Usage: protected-config setup|verify|cleanup fixture.sql; explicit DDL consent required");
        }
        Properties p = new Properties();
        try (var input = Files.newInputStream(Path.of(args[0]))) { p.load(input); }
        Class.forName(required(p, "driverClass"));
        p.setProperty("connectTimeout", "10");
        p.setProperty("socketTimeout", "20");
        try (var connection = DriverManager.getConnection(p.getProperty("url"), p)) {
            switch (args[1]) {
                case "setup" -> {
                    // This intentionally handles only the accompanying fixed fixture,
                    // not arbitrary PL/SQL or the DBeaver script parser.
                    String sql = Files.readString(Path.of(args[2]))
                        .replaceAll("(?m)^--.*$", "").replace("\\set ON_ERROR_STOP on", "");
                    String marker = "CREATE PROCEDURE " + SCHEMA + ".write_then_wait";
                    int procedure = sql.indexOf(marker);
                    int slash = sql.indexOf("\n/", procedure);
                    if (procedure < 0 || slash < 0 || !sql.substring(slash + 2).strip().equals("COMMIT;")) {
                        throw new IllegalArgumentException("Unexpected fixture format");
                    }
                    connection.setAutoCommit(false);
                    try {
                        for (String command : sql.substring(0, procedure).split(";")) {
                            if (!command.isBlank() && !command.strip().equals("BEGIN")) execute(connection, command);
                        }
                        execute(connection, sql.substring(procedure, slash));
                        connection.commit();
                    } catch (Exception failure) {
                        try { connection.rollback(); } catch (SQLException cleanup) { failure.addSuppressed(cleanup); }
                        throw failure;
                    }
                    System.out.println("CREATED " + SCHEMA);
                }
                case "verify", "cleanup" -> {
                    try (var s = connection.createStatement()) {
                        s.setQueryTimeout(10);
                        try (var r = s.executeQuery("SELECT nspowner=(SELECT oid FROM pg_roles WHERE rolname=current_user) FROM pg_namespace WHERE nspname='" + SCHEMA + "'")) {
                            if (!r.next() || !r.getBoolean(1)) throw new IllegalStateException("Fixture not owned by this user");
                        }
                        try (var r = s.executeQuery("SELECT count(*),min(id),max(id) FROM " + SCHEMA + ".audit")) {
                            if (!r.next() || r.getInt(1) != 1 || r.getInt(2) != 1 || r.getInt(3) != 1) {
                                throw new IllegalStateException("Baseline changed or uncommitted write survived");
                            }
                        }
                        try (var r = s.executeQuery("SELECT count(*) FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND usename=current_user AND query LIKE '%" + SCHEMA + ".write_then_wait%'")) {
                            if (!r.next() || r.getInt(1) != 0) throw new IllegalStateException("Target still present; refusing cleanup");
                        }
                    }
                    System.out.println("VERIFIED baseline retained; no target CALL");
                    if (args[1].equals("cleanup")) {
                        connection.setAutoCommit(false);
                        try {
                            // RESTRICT and one transaction protect unrelated objects and
                            // dependencies. A failed final DROP restores the fixture too.
                            execute(connection, "DROP PROCEDURE " + SCHEMA + ".write_then_wait(integer) RESTRICT");
                            execute(connection, "DROP TABLE " + SCHEMA + ".audit RESTRICT");
                            execute(connection, "DROP SCHEMA " + SCHEMA + " RESTRICT");
                            connection.commit();
                        } catch (Exception failure) {
                            try { connection.rollback(); } catch (SQLException cleanup) { failure.addSuppressed(cleanup); }
                            throw failure;
                        }
                        System.out.println("CLEANED " + SCHEMA);
                    }
                }
                default -> throw new IllegalArgumentException("Unknown fixture action");
            }
        }
    }
    private static void execute(Connection c, String sql) throws SQLException {
        try (var s = c.createStatement()) { s.setQueryTimeout(10); s.execute(sql); }
    }
    private static String required(Properties properties, String key) {
        String value = properties.getProperty(key);
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Missing required connection property: " + key);
        }
        return value.strip();
    }
}
