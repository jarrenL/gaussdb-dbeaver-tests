import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.Properties;

/** Disposable package fixture; SQL is fixed and cleanup never uses schema CASCADE. */
public class GuiPackageFixture {
    static final String SCHEMA = "dbv_pkg_gui_repeatable";
    static final String SESSION_SETTINGS_CONSENT = "GAUSSDB_PACKAGE_ALLOW_SESSION_SETTINGS";

    public static void main(String[] args) throws Exception {
        if (args.length != 1 || !java.util.Set.of("probe", "setup", "verify", "cleanup").contains(args[0])) {
            throw new IllegalArgumentException("Usage: GuiPackageFixture probe|setup|verify|cleanup");
        }
        try (Connection c = connect(!args[0].equals("probe"))) {
            if (args[0].equals("probe")) {
                PackageCapability capability = detectCapability(c);
                System.out.println("PACKAGE CAPABILITY " + capability.summary());
                return;
            }
            if (!prepareAction(c, args[0])) return;
            run(c, args[0]);
        }
    }

    static Connection connect() throws Exception {
        return connect(true);
    }

    static Connection connect(boolean requireDdlConsent) throws Exception {
        if (requireDdlConsent && !"YES".equals(System.getenv("GAUSSDB_HISTORY_ALLOW_DDL"))) {
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
                System.out.println("SESSION SETTINGS transaction-local: enable_force_create_obj=on;"
                    + " plsql_show_all_error=off");
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

    static boolean prepareAction(Connection c, String action) throws SQLException {
        if (action.equals("cleanup")) {
            if (!schemaExists(c)) {
                System.out.println("CLEANUP NOT NEEDED package fixture schema is absent");
                return false;
            }
            return true;
        }
        PackageCapability capability = detectCapability(c);
        if (!capability.supportsInvalidPackageBody()) {
            System.out.println("RESULT UNSUPPORTED test=package-invalid-body reason=unsupported-server "
                + capability.summary());
            return false;
        }
        if (action.equals("setup") && !"YES".equals(System.getenv(SESSION_SETTINGS_CONSENT))) {
            System.out.println("RESULT SKIP test=package-invalid-body reason=session-settings-not-authorized"
                + " required=" + SESSION_SETTINGS_CONSENT + "=YES");
            return false;
        }
        return true;
    }

    static PackageCapability detectCapability(Connection c) throws SQLException {
        boolean deploymentFunction = count(c, "SELECT count(*) FROM pg_catalog.pg_proc p"
            + " JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace"
            + " WHERE n.nspname='pg_catalog' AND lower(p.proname::text)='gs_deployment'") > 0;
        String deployment = deploymentFunction
            ? text(c, "SELECT pg_catalog.gs_deployment()")
            : "unknown";
        String compatibility = text(c, "SELECT COALESCE("
            + "(SELECT setting FROM pg_catalog.pg_settings WHERE lower(name)='sql_compatibility'),"
            + "(SELECT datcompatibility::text FROM pg_catalog.pg_database WHERE datname=current_database()),'')");
        boolean packageCatalog = relationExists(c, "pg_catalog", "gs_package");
        boolean forceCreateSetting = settingExists(c, "enable_force_create_obj");
        boolean showAllErrorSetting = settingExists(c, "plsql_show_all_error");
        boolean errorsCatalog = relationExists(c, "dbe_pldeveloper", "gs_errors");
        boolean sourceCatalog = relationExists(c, "dbe_pldeveloper", "gs_source");
        return new PackageCapability(deployment, compatibility, packageCatalog, forceCreateSetting,
            showAllErrorSetting, errorsCatalog, sourceCatalog);
    }

    private static boolean schemaExists(Connection c) throws SQLException {
        return count(c, "SELECT count(*) FROM pg_catalog.pg_namespace WHERE nspname='" + SCHEMA + "'") > 0;
    }

    private static boolean relationExists(Connection c, String schema, String relation) throws SQLException {
        return count(c, "SELECT count(*) FROM pg_catalog.pg_class c"
            + " JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace"
            + " WHERE n.nspname='" + schema + "' AND lower(c.relname::text)='" + relation + "'") > 0;
    }

    private static boolean settingExists(Connection c, String name) throws SQLException {
        return count(c, "SELECT count(*) FROM pg_catalog.pg_settings WHERE lower(name)='" + name + "'") > 0;
    }

    private static int count(Connection c, String sql) throws SQLException {
        try (var s = c.createStatement()) {
            s.setQueryTimeout(10);
            try (var r = s.executeQuery(sql)) {
                if (!r.next()) throw new IllegalStateException("Capability query returned no row");
                return r.getInt(1);
            }
        }
    }

    private static String text(Connection c, String sql) throws SQLException {
        try (var s = c.createStatement()) {
            s.setQueryTimeout(10);
            try (var r = s.executeQuery(sql)) {
                if (!r.next()) throw new IllegalStateException("Capability query returned no row");
                String value = r.getString(1);
                return value == null ? "" : value.trim();
            }
        }
    }

    record PackageCapability(
        String deployment,
        String compatibility,
        boolean packageCatalog,
        boolean forceCreateSetting,
        boolean showAllErrorSetting,
        boolean errorsCatalog,
        boolean sourceCatalog
    ) {
        boolean supportsInvalidPackageBody() {
            String normalizedDeployment = deployment.toLowerCase(java.util.Locale.ROOT);
            String normalizedCompatibility = compatibility.toUpperCase(java.util.Locale.ROOT);
            return normalizedDeployment.contains("central")
                && java.util.Set.of("A", "O", "ORA").contains(normalizedCompatibility)
                && packageCatalog && forceCreateSetting && showAllErrorSetting && errorsCatalog && sourceCatalog;
        }

        String summary() {
            return "deployment=" + deployment + " compatibility=" + compatibility
                + " packageCatalog=" + packageCatalog
                + " enable_force_create_obj=" + forceCreateSetting
                + " plsql_show_all_error=" + showAllErrorSetting
                + " gs_errors=" + errorsCatalog
                + " gs_source=" + sourceCatalog
                + " invalidBody=" + supportsInvalidPackageBody();
        }
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
