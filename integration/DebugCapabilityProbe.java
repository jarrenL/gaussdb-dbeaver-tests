import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.Driver;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Properties;

/** Emits only sanitized dimensions used by the external debugger compatibility matrix. */
public final class DebugCapabilityProbe {
    private static final String API_NAMES =
        "'turn_on','turn_off','attach','continue','step','next','finish','abort','backtrace',"
        + "'info_locals','info_code','set_var','add_breakpoint','delete_breakpoint',"
        + "'enable_breakpoint','disable_breakpoint','info_breakpoints'";

    private DebugCapabilityProbe() {
    }

    public static void main(String[] args) throws Exception {
        if (args.length != 1) {
            throw new IllegalArgumentException("Usage: DebugCapabilityProbe <private-connection.properties>");
        }
        Properties properties = load(Path.of(args[0]));
        String driverClass = required(properties, "driverClass");
        String url = required(properties, "url");
        Class<?> loaded = Class.forName(driverClass);
        if (!Driver.class.isAssignableFrom(loaded)) {
            throw new IllegalArgumentException("Configured driverClass does not implement java.sql.Driver");
        }
        Driver driver = (Driver) loaded.getDeclaredConstructor().newInstance();
        if (!driver.acceptsURL(url)) {
            throw new IllegalArgumentException("Configured driverClass does not accept the configured JDBC URL");
        }
        Properties connectionProperties = new Properties();
        connectionProperties.putAll(properties);
        connectionProperties.remove("driverClass");
        connectionProperties.putIfAbsent("connectTimeout", "10");
        connectionProperties.putIfAbsent("socketTimeout", "20");
        try (Connection connection = driver.connect(url, connectionProperties)) {
            if (connection == null) {
                throw new SQLException("Configured JDBC driver declined the connection URL");
            }
            System.out.println(toJson(probe(connection, driver.getClass().getName())));
        }
    }

    static Probe probe(Connection connection, String driverClass) throws SQLException {
        DatabaseMetaData metadata = connection.getMetaData();
        String driverVersion = metadata.getDriverVersion();
        if (driverVersion == null || driverVersion.isBlank()) {
            driverVersion = metadata.getDriverMajorVersion() + "." + metadata.getDriverMinorVersion();
        }
        String serverVersion = scalar(connection, "SELECT version()");
        String compatibility = scalar(connection,
            "SELECT datcompatibility FROM pg_catalog.pg_database WHERE datname=current_database()");
        List<ApiSignature> signatures = new ArrayList<>();
        String sql = "SELECT lower(p.proname),trim(p.proargtypes::text),"
            + "pg_catalog.has_function_privilege(p.oid,'EXECUTE') "
            + "FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace "
            + "WHERE upper(n.nspname)='DBE_PLDEBUGGER' AND lower(p.proname) IN (" + API_NAMES + ") "
            + "ORDER BY lower(p.proname),trim(p.proargtypes::text),p.oid";
        try (Statement statement = connection.createStatement()) {
            statement.setQueryTimeout(15);
            try (ResultSet rows = statement.executeQuery(sql)) {
                while (rows.next()) {
                    signatures.add(new ApiSignature(rows.getString(1), normalizeArguments(rows.getString(2)),
                        rows.getBoolean(3)));
                }
            }
        }
        signatures.sort(Comparator.comparing((ApiSignature item) -> item.name)
            .thenComparing(item -> item.arguments).thenComparing(item -> item.executable));
        return new Probe(driverClass, driverVersion, serverVersion, compatibility, signatures);
    }

    private static Properties load(Path file) throws IOException {
        Properties properties = new Properties();
        try (var input = Files.newInputStream(file)) {
            properties.load(input);
        }
        return properties;
    }

    private static String required(Properties properties, String key) {
        String value = properties.getProperty(key);
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Missing required connection property: " + key);
        }
        return value.strip();
    }

    private static String scalar(Connection connection, String sql) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.setQueryTimeout(15);
            try (ResultSet rows = statement.executeQuery(sql)) {
                if (!rows.next()) {
                    throw new SQLException("Capability query returned no rows");
                }
                String value = rows.getString(1);
                if (value == null || value.isBlank() || rows.wasNull()) {
                    throw new SQLException("Capability query returned an empty value");
                }
                return value.strip();
            }
        }
    }

    private static String normalizeArguments(String value) {
        return value == null ? "" : value.trim().replaceAll("\\s+", " ");
    }

    static String toJson(Probe probe) {
        StringBuilder json = new StringBuilder("{");
        append(json, "driverClass", probe.driverClass).append(',');
        append(json, "driverVersion", probe.driverVersion).append(',');
        append(json, "serverVersion", probe.serverVersion).append(',');
        append(json, "compatibility", probe.compatibility).append(',');
        json.append("\"apiSignatures\":[");
        for (int index = 0; index < probe.apiSignatures.size(); index++) {
            if (index > 0) {
                json.append(',');
            }
            ApiSignature signature = probe.apiSignatures.get(index);
            json.append('{');
            append(json, "name", signature.name).append(',');
            append(json, "arguments", signature.arguments).append(',');
            json.append("\"executable\":").append(signature.executable).append('}');
        }
        return json.append("]}").toString();
    }

    private static StringBuilder append(StringBuilder json, String key, String value) {
        return json.append('"').append(escape(key)).append("\":\"").append(escape(value)).append('"');
    }

    private static String escape(String value) {
        StringBuilder escaped = new StringBuilder();
        for (int index = 0; index < value.length(); index++) {
            char character = value.charAt(index);
            switch (character) {
                case '"': escaped.append("\\\""); break;
                case '\\': escaped.append("\\\\"); break;
                case '\b': escaped.append("\\b"); break;
                case '\f': escaped.append("\\f"); break;
                case '\n': escaped.append("\\n"); break;
                case '\r': escaped.append("\\r"); break;
                case '\t': escaped.append("\\t"); break;
                default:
                    if (character < 0x20) {
                        escaped.append(String.format("\\u%04x", (int) character));
                    } else {
                        escaped.append(character);
                    }
            }
        }
        return escaped.toString();
    }

    static final class Probe {
        final String driverClass;
        final String driverVersion;
        final String serverVersion;
        final String compatibility;
        final List<ApiSignature> apiSignatures;

        Probe(String driverClass, String driverVersion, String serverVersion, String compatibility,
            List<ApiSignature> apiSignatures) {
            this.driverClass = driverClass;
            this.driverVersion = driverVersion;
            this.serverVersion = serverVersion;
            this.compatibility = compatibility;
            this.apiSignatures = List.copyOf(apiSignatures);
        }
    }

    static final class ApiSignature {
        final String name;
        final String arguments;
        final boolean executable;

        ApiSignature(String name, String arguments, boolean executable) {
            this.name = name;
            this.arguments = arguments;
            this.executable = executable;
        }
    }
}
