import java.net.URI;
import java.net.URISyntaxException;
import java.net.URLDecoder;
import java.net.URLClassLoader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermission;
import java.sql.Connection;
import java.sql.Driver;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.EnumSet;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Properties;
import java.util.Set;

/** Creates and removes the exact disposable ORA database used by opt-in live review tests. */
public final class IsolatedReviewDatabase {
    private IsolatedReviewDatabase() {
    }

    public static void main(String[] args) throws Exception {
        if (args.length != 3 || !args[0].matches("create|drop|status")) {
            throw new IllegalArgumentException("Usage: create|drop|status connection.properties vendor-jdbc.jar");
        }
        Path propertiesFile = requirePrivatePropertiesFile(args[1]);
        Path driverJar = requireDriverJar(args[2]);
        Properties properties = new Properties();
        try (var input = Files.newInputStream(propertiesFile)) {
            properties.load(input);
        }
        String prefix = properties.getProperty("review.databasePrefix");
        if (prefix == null || !prefix.matches("review_0917_[a-f0-9]{8}_")) {
            throw new IllegalArgumentException("Connection must declare a safe isolated review prefix");
        }
        String database = prefix + "ora";
        if (!database.equals(properties.getProperty("database"))) {
            throw new IllegalArgumentException("Configured database does not match the isolated review prefix");
        }
        String endpointBinding = requireConnectionBinding(properties, database);
        String adminUrl = buildAdminUrl(properties.getProperty("url"), database);
        String driverClass = properties.getProperty(
            "review.driverClass", properties.getProperty("driverClass"));
        if (driverClass == null || !driverClass.matches("[A-Za-z_$][A-Za-z0-9_.$]*")) {
            throw new IllegalArgumentException("A valid vendor JDBC driver class is required");
        }
        Properties connectionProperties = connectionProperties(properties);
        try (var loader = new URLClassLoader(
                new java.net.URL[]{driverJar.toUri().toURL()}, ClassLoader.getPlatformClassLoader())) {
            Driver driver = (Driver) loader.loadClass(driverClass)
                .getConstructor().newInstance();
            try (Connection connection = driver.connect(adminUrl, connectionProperties)) {
                if (connection == null) {
                    throw new IllegalStateException("Vendor driver rejected the configured URL");
                }
                requireAdminConnection(connection, endpointBinding);
                switch (args[0]) {
                    case "create" -> create(connection, database);
                    case "drop" -> drop(connection, database);
                    case "status" -> status(connection, database);
                    default -> throw new IllegalStateException("Unreachable action");
                }
            }
        }
    }

    private static Path requirePrivatePropertiesFile(String value) throws Exception {
        Path path = Path.of(value);
        if (!path.isAbsolute()) {
            throw new IllegalArgumentException("Connection properties path must be absolute");
        }
        path = path.normalize();
        if (Files.isSymbolicLink(path) || !Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS)) {
            throw new IllegalArgumentException("Connection properties must be a regular non-symbolic file");
        }
        Set<PosixFilePermission> expected = EnumSet.of(
            PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_WRITE);
        Set<PosixFilePermission> actual;
        try {
            actual = Files.getPosixFilePermissions(path, LinkOption.NOFOLLOW_LINKS);
        } catch (UnsupportedOperationException e) {
            throw new IllegalStateException("POSIX file permissions are required for live review secrets", e);
        }
        if (!actual.equals(expected)) {
            throw new IllegalArgumentException("Connection properties must have owner-only 0600 permissions");
        }
        String userName = System.getProperty("user.name");
        if (userName == null || !Files.getOwner(path, LinkOption.NOFOLLOW_LINKS).equals(
            path.getFileSystem().getUserPrincipalLookupService().lookupPrincipalByName(userName))) {
            throw new IllegalArgumentException("Connection properties must be owned by the current user");
        }
        return path;
    }

    private static Path requireDriverJar(String value) {
        Path path = Path.of(value);
        if (!path.isAbsolute()) {
            throw new IllegalArgumentException("Vendor JDBC path must be absolute");
        }
        path = path.normalize();
        if (Files.isSymbolicLink(path) || !Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS)
            || !Files.isReadable(path)) {
            throw new IllegalArgumentException("Vendor JDBC path must be a readable regular non-symbolic file");
        }
        return path;
    }

    private static String buildAdminUrl(String configuredUrl, String expectedDatabase) {
        URI uri = configuredUri(configuredUrl, expectedDatabase);
        return "jdbc:gaussdb://" + uri.getRawAuthority() + "/postgres"
            + (uri.getRawQuery() == null ? "" : "?" + uri.getRawQuery());
    }

    private static URI configuredUri(String configuredUrl, String expectedDatabase) {
        if (configuredUrl == null || !configuredUrl.startsWith("jdbc:gaussdb://")) {
            throw new IllegalArgumentException("Absolute jdbc:gaussdb URL required");
        }
        URI uri;
        try {
            uri = new URI(configuredUrl.substring("jdbc:".length()));
        } catch (URISyntaxException e) {
            throw new IllegalArgumentException("Configured JDBC URL is invalid", e);
        }
        if (!"gaussdb".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null
            || uri.getRawUserInfo() != null || uri.getFragment() != null
            || uri.getPort() < 1 || uri.getPort() > 65535
            || !("/" + expectedDatabase).equals(uri.getRawPath())
            || queryContainsCredentials(uri.getRawQuery())) {
            throw new IllegalArgumentException("Configured JDBC URL does not identify the isolated review database");
        }
        return uri;
    }

    private static boolean queryContainsCredentials(String rawQuery) {
        if (rawQuery == null || rawQuery.isEmpty()) return false;
        for (String parameter : rawQuery.split("&")) {
            String rawKey = parameter.split("=", 2)[0];
            String key;
            try {
                key = URLDecoder.decode(rawKey, StandardCharsets.UTF_8).toLowerCase(Locale.ROOT);
            } catch (IllegalArgumentException invalidEncoding) {
                throw new IllegalArgumentException("Configured JDBC URL query is invalid", invalidEncoding);
            }
            if (Set.of("user", "username", "password", "passwd", "sslpassword").contains(key)) return true;
        }
        return false;
    }

    static String requireConnectionBinding(Properties properties, String expectedDatabase) {
        String instanceId = properties.getProperty("instanceId");
        if (instanceId == null || !instanceId.matches("[A-Za-z0-9][A-Za-z0-9_-]{15,127}")) {
            throw new IllegalArgumentException("A valid bound centralized instance identity is required");
        }
        if (!"centralized".equals(properties.getProperty("review.deployment"))) {
            throw new IllegalArgumentException("Review connection must require centralized deployment");
        }
        URI uri = configuredUri(properties.getProperty("url"), expectedDatabase);
        String endpoint = canonicalEndpoint(uri.getHost(), uri.getPort());
        if (!endpoint.equals(properties.getProperty("review.endpoint"))) {
            throw new IllegalArgumentException("Review endpoint does not match the configured JDBC URL");
        }
        String configuredBinding = properties.getProperty("review.endpointBinding");
        String expectedBinding = endpointBinding(instanceId, endpoint);
        if (configuredBinding == null || !configuredBinding.matches("[a-f0-9]{64}")
            || !configuredBinding.equals(expectedBinding)) {
            throw new IllegalArgumentException("Review endpoint binding does not match instance and endpoint");
        }
        return configuredBinding;
    }

    static String endpointBinding(String instanceId, String endpoint) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            digest.update(instanceId.getBytes(StandardCharsets.UTF_8));
            digest.update((byte) 0);
            digest.update(endpoint.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest.digest());
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }

    private static String canonicalEndpoint(String value, int port) {
        String host = value.replaceAll("^\\[|\\]$", "").toLowerCase(Locale.ROOT);
        return (host.contains(":") ? "[" + host + "]" : host) + ":" + port;
    }

    private static Properties connectionProperties(Properties configured) {
        Properties result = new Properties();
        result.putAll(configured);
        result.remove("url");
        result.remove("database");
        result.remove("host");
        result.remove("port");
        result.remove("instanceId");
        result.stringPropertyNames().stream()
            .filter(name -> name.startsWith("review."))
            .toList()
            .forEach(result::remove);
        return result;
    }

    private static void requireAdminConnection(Connection connection, String endpointBinding) throws Exception {
        if (!connection.getAutoCommit() || connection.isReadOnly()) {
            throw new IllegalStateException("Administrative database connection must be writable and autocommit");
        }
        try (Statement statement = connection.createStatement()) {
            statement.setQueryTimeout(30);
            try (ResultSet result = statement.executeQuery(
                "SELECT current_database(), pg_catalog.gs_deployment()")) {
                if (!result.next() || !"postgres".equals(result.getString(1))) {
                    throw new IllegalStateException("Administrative connection is not attached to postgres");
                }
                String deployment = result.getString(2);
                if (!isCentralizedDeployment(deployment) || result.next()) {
                    throw new IllegalStateException("Review target is not a centralized GaussDB deployment");
                }
            }
        }
        System.out.println("CENTRALIZED REVIEW TARGET VERIFIED deployment=centralized binding="
            + endpointBinding);
    }

    static boolean isCentralizedDeployment(String value) {
        if (value == null) return false;
        String normalized = value.trim().toLowerCase(Locale.ROOT).replaceAll("[\\s_-]+", "");
        return Set.of("centralized", "businesscentralized", "singlecentralized").contains(normalized);
    }

    private static void create(Connection connection, String database) throws Exception {
        if (count(connection, "SELECT count(*) FROM pg_database WHERE datname=?", database) != 0) {
            throw new IllegalStateException("Refusing to adopt a pre-existing review database");
        }
        try (Statement statement = connection.createStatement()) {
            statement.setQueryTimeout(30);
            // GaussDB 505 uses the catalog value A for Oracle compatibility.
            // Newer releases may also accept the ORA alias, but A is portable
            // across the two 505 deployment forms covered by this acceptance run.
            statement.execute("CREATE DATABASE " + database + " DBCOMPATIBILITY='A'");
        }
        String compatibility = requireOwnedOraDatabase(connection, database);
        System.out.println("ISOLATED REVIEW DATABASE CREATED compatibility=" + compatibility);
    }

    private static void drop(Connection connection, String database) throws Exception {
        requireOwnedOraDatabase(connection, database);
        if (count(connection,
            "SELECT count(*) FROM pg_stat_activity WHERE datname=? AND pid<>pg_backend_pid()", database) != 0) {
            throw new IllegalStateException("Review database still has active sessions");
        }
        try (Statement statement = connection.createStatement()) {
            statement.setQueryTimeout(30);
            statement.execute("DROP DATABASE " + database);
        }
        if (count(connection, "SELECT count(*) FROM pg_database WHERE datname=?", database) != 0) {
            throw new IllegalStateException("Review database cleanup did not converge");
        }
        System.out.println("ISOLATED REVIEW DATABASE REMOVED");
    }

    private static void status(Connection connection, String database) throws Exception {
        long exists = count(connection, "SELECT count(*) FROM pg_database WHERE datname=?", database);
        long sessions = count(connection,
            "SELECT count(*) FROM pg_stat_activity WHERE datname=? AND pid<>pg_backend_pid()", database);
        if (exists > 1 || (exists == 0 && sessions != 0)) {
            throw new IllegalStateException("Review database catalog state is inconsistent");
        }
        String compatibility = exists == 1 ? requireOwnedOraDatabase(connection, database) : "absent";
        System.out.println("ISOLATED REVIEW DATABASE STATUS exists=" + exists + " sessions=" + sessions
            + " compatibility=" + compatibility);
    }

    private static String requireOwnedOraDatabase(Connection connection, String database) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement("""
            SELECT datcompatibility,
                   datdba=(SELECT usesysid FROM pg_user WHERE usename=current_user)
              FROM pg_database
             WHERE datname=?
            """)) {
            statement.setQueryTimeout(30);
            statement.setString(1, database);
            try (ResultSet result = statement.executeQuery()) {
                if (!result.next()) {
                    throw new IllegalStateException("Review database identity or ownership mismatch");
                }
                String compatibility = result.getString(1);
                if (!result.getBoolean(2)
                    || !("A".equalsIgnoreCase(compatibility)
                        || "ORA".equalsIgnoreCase(compatibility))
                    || result.next()) {
                    throw new IllegalStateException("Review database identity or ownership mismatch");
                }
                return compatibility.toUpperCase(java.util.Locale.ROOT);
            }
        }
    }

    private static long count(Connection connection, String sql, String value) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setQueryTimeout(30);
            statement.setString(1, value);
            try (ResultSet result = statement.executeQuery()) {
                if (!result.next()) {
                    throw new IllegalStateException("Count query returned no row");
                }
                long count = result.getLong(1);
                if (result.next()) {
                    throw new IllegalStateException("Count query returned multiple rows");
                }
                return count;
            }
        }
    }
}
