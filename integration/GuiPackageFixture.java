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
    static final String BAD_TYPE_TOKEN = "no_such_table.id%TYPE";
    static final String BAD_BODY_SQL = """
        CREATE PACKAGE BODY dbv_pkg_gui_repeatable.gui_bad AS
          FUNCTION value_of RETURN INTEGER AS
            missing dbv_pkg_gui_repeatable.no_such_table.id%TYPE;
          BEGIN
            RETURN 42;
          END;
        END gui_bad;
        """;

    public static void main(String[] args) throws Exception {
        if (args.length != 1 || !java.util.Set.of("probe", "setup", "verify", "cleanup").contains(args[0])) {
            throw new IllegalArgumentException("Usage: GuiPackageFixture probe|setup|verify|cleanup");
        }
        try {
            try (Connection c = connect(!args[0].equals("probe"))) {
                if (args[0].equals("probe")) {
                    PackageCapability capability = detectCapability(c);
                    System.out.println("PACKAGE CAPABILITY " + capability.summary());
                    return;
                }
                if (!prepareAction(c, args[0])) return;
                printResult(run(c, args[0]));
            }
        } catch (Exception failure) {
            System.out.println("RESULT FAIL test=package-fixture action=" + args[0]
                + " error=" + oneLine(failure.getMessage()));
            throw failure;
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

    static ActionResult run(Connection c, String action) throws SQLException {
        if (!c.getAutoCommit()) throw new IllegalStateException("Dedicated auto-commit connection required");
        PackageCapability capability = detectCapability(c);
        PackageMode mode = capability.mode();
        if (action.equals("verify")) {
            owned(c);
            check(c, "SELECT count(*) FROM gs_package p JOIN pg_namespace n ON n.oid=p.pkgnamespace"
                + " WHERE n.nspname='" + SCHEMA + "' AND p.pkgname IN ('gui_valid','gui_bad')", 2);
            check(c, "SELECT " + SCHEMA + ".gui_valid.value_of()", 42);
            if (mode == PackageMode.STRUCTURED) {
                System.out.println("VERIFIED package mode=structured packageCount=2 validResult=42");
                return ActionResult.pass("package-" + action, "mode=structured packageCount=2 validResult=42");
            } else if (mode == PackageMode.SOURCE_REPLAY) {
                return verifySourceReplay(c);
            } else {
                throw new IllegalStateException("Package fixture is unsupported: " + capability.summary());
            }
        }
        if (!action.equals("setup") && !action.equals("cleanup")) throw new IllegalArgumentException("Unknown action");
        boolean committedSetup = false;
        c.setAutoCommit(false);
        try {
            if (action.equals("setup")) {
                // No IF NOT EXISTS: never adopt a pre-existing schema.
                execute(c, "CREATE SCHEMA " + SCHEMA);
                if (mode == PackageMode.STRUCTURED) {
                    System.out.println("SESSION SETTINGS transaction-local: enable_force_create_obj=on;"
                        + " plsql_show_all_error=off");
                    execute(c, "SET LOCAL enable_force_create_obj=on");
                    execute(c, "SET LOCAL plsql_show_all_error=off");
                }
                createPackageSpecification(c, "gui_valid");
                execute(c, validBodySql());
                createPackageSpecification(c, "gui_bad");
                if (mode == PackageMode.STRUCTURED) execute(c, BAD_BODY_SQL);
                c.commit();
                committedSetup = true;
                c.setAutoCommit(true);
                if (mode == PackageMode.SOURCE_REPLAY) {
                    check(c, "SELECT " + SCHEMA + ".gui_valid.value_of()", 42);
                    System.out.println("PACKAGE BASE VERIFIED mode=source-replay validResult=42");
                    ActionResult sourceResult = createExpectedInvalidBody(c);
                    if (!sourceResult.isPass()) {
                        run(c, "cleanup");
                        return sourceResult.withDetails(sourceResult.details() + " validPackage=true cleaned=true");
                    }
                }
                return ActionResult.pass("package-" + action, "mode=" + mode.externalName());
            } else {
                owned(c);
                // GUI deletion may already have removed these two packages.
                execute(c, "DROP PACKAGE IF EXISTS " + SCHEMA + ".gui_bad");
                execute(c, "DROP PACKAGE IF EXISTS " + SCHEMA + ".gui_valid");
                execute(c, "DROP SCHEMA " + SCHEMA + " RESTRICT");
            }
            c.commit();
        } catch (Exception failure) {
            if (action.equals("setup") && committedSetup) {
                try {
                    c.setAutoCommit(true);
                    run(c, "cleanup");
                } catch (Exception cleanup) {
                    failure.addSuppressed(cleanup);
                }
            } else {
                try { c.rollback(); } catch (SQLException rollback) { failure.addSuppressed(rollback); }
            }
            throw failure;
        } finally {
            c.setAutoCommit(true);
        }
        return ActionResult.pass("package-" + action, "mode=" + mode.externalName());
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
        if (capability.mode() == PackageMode.UNSUPPORTED) {
            System.out.println("RESULT UNSUPPORTED test=package-compile-diagnostics reason=unsupported-server "
                + capability.summary());
            return false;
        }
        if (action.equals("setup") && capability.mode() == PackageMode.STRUCTURED
            && !"YES".equals(System.getenv(SESSION_SETTINGS_CONSENT))) {
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
        PackageMode mode() {
            if (supportsInvalidPackageBody()) return PackageMode.STRUCTURED;
            if (supportsSourceReplay()) return PackageMode.SOURCE_REPLAY;
            return PackageMode.UNSUPPORTED;
        }

        boolean supportsInvalidPackageBody() {
            String normalizedDeployment = deployment.strip().toLowerCase(java.util.Locale.ROOT)
                .replaceAll("[\\s_-]+", "");
            String normalizedCompatibility = compatibility.toUpperCase(java.util.Locale.ROOT);
            return java.util.Set.of("centralized", "businesscentralized", "singlecentralized")
                    .contains(normalizedDeployment)
                && java.util.Set.of("A", "O", "ORA").contains(normalizedCompatibility)
                && packageCatalog && forceCreateSetting && showAllErrorSetting && errorsCatalog && sourceCatalog;
        }

        boolean supportsSourceReplay() {
            String normalizedCompatibility = compatibility.toUpperCase(java.util.Locale.ROOT);
            return java.util.Set.of("A", "O", "ORA").contains(normalizedCompatibility)
                && packageCatalog && sourceCatalog;
        }

        String summary() {
            return "deployment=" + deployment + " compatibility=" + compatibility
                + " packageCatalog=" + packageCatalog
                + " enable_force_create_obj=" + forceCreateSetting
                + " plsql_show_all_error=" + showAllErrorSetting
                + " gs_errors=" + errorsCatalog
                + " gs_source=" + sourceCatalog
                + " invalidBody=" + supportsInvalidPackageBody()
                + " sourceReplay=" + supportsSourceReplay()
                + " mode=" + mode().externalName();
        }
    }

    enum PackageMode {
        STRUCTURED("structured"),
        SOURCE_REPLAY("source-replay"),
        UNSUPPORTED("unsupported");

        private final String externalName;

        PackageMode(String externalName) {
            this.externalName = externalName;
        }

        String externalName() {
            return externalName;
        }
    }

    private static void createPackageSpecification(Connection c, String name) throws SQLException {
        execute(c, "CREATE PACKAGE " + SCHEMA + "." + name
            + " AS FUNCTION value_of RETURN INTEGER; END " + name + ";");
    }

    private static String validBodySql() {
        return "CREATE PACKAGE BODY " + SCHEMA + ".gui_valid AS "
            + "FUNCTION value_of RETURN INTEGER AS BEGIN RETURN 42; END; END gui_valid;";
    }

    private static ActionResult createExpectedInvalidBody(Connection c) throws SQLException {
        SQLException directError = null;
        try {
            execute(c, BAD_BODY_SQL);
        } catch (SQLException expected) {
            directError = expected;
        }
        if (directError == null) {
            return ActionResult.unsupported("package-direct-error", "invalid-body-did-not-raise",
                "mode=source-replay");
        } else {
            Diagnostic diagnostic = validateDirectDiagnostic(directError, BAD_BODY_SQL);
            System.out.println("PACKAGE DIAGNOSTIC mode=source-replay phase=create"
                + " sqlState=" + diagnostic.sqlState()
                + " vendorCode=" + diagnostic.vendorCode()
                + " inferredLine=" + diagnostic.inferredLine()
                + " message=" + diagnostic.message());
        }
        String retained;
        try {
            retained = readInvalidBodySource(c);
        } catch (SQLException unavailable) {
            return ActionResult.unsupported("package-source-replay", "source-catalog-unreadable",
                "sqlState=" + nullSafe(unavailable.getSQLState())
                    + " mode=source-replay directError=true");
        }
        if (retained == null) {
            return ActionResult.unsupported("package-source-replay", "invalid-source-not-retained",
                "mode=source-replay directError=true");
        } else if (!retained.toLowerCase(java.util.Locale.ROOT)
            .contains(BAD_TYPE_TOKEN.toLowerCase(java.util.Locale.ROOT))) {
            throw new IllegalStateException("Retained invalid package body does not contain expected source token");
        } else {
            System.out.println("PACKAGE SOURCE mode=source-replay retained=true status=invalid");
        }
        return ActionResult.pass("package-source-replay",
            "mode=source-replay directError=true sourceRetained=true");
    }

    private static ActionResult verifySourceReplay(Connection c) throws SQLException {
        String source;
        try {
            source = readInvalidBodySource(c);
        } catch (SQLException unavailable) {
            System.out.println("VERIFIED package mode=source-replay packageCount=2 validResult=42");
            return ActionResult.unsupported("package-source-replay", "source-catalog-unreadable",
                "sqlState=" + nullSafe(unavailable.getSQLState())
                    + " mode=source-replay validPackage=true");
        }
        if (source == null) {
            System.out.println("VERIFIED package mode=source-replay packageCount=2 validResult=42");
            return ActionResult.unsupported("package-source-replay", "invalid-source-not-retained",
                "mode=source-replay validPackage=true");
        }
        SQLException directError = null;
        try {
            execute(c, asCreateOrReplace(source));
        } catch (SQLException expected) {
            directError = expected;
        }
        if (directError == null) {
            return ActionResult.unsupported("package-source-replay", "replay-did-not-raise",
                "mode=source-replay validPackage=true sourceRetained=true");
        }
        Diagnostic diagnostic = validateDirectDiagnostic(directError, source);
        System.out.println("PACKAGE DIAGNOSTIC mode=source-replay phase=replay"
            + " sqlState=" + diagnostic.sqlState()
            + " vendorCode=" + diagnostic.vendorCode()
            + " inferredLine=" + diagnostic.inferredLine()
            + " message=" + diagnostic.message());
        System.out.println("VERIFIED package mode=source-replay packageCount=2 validResult=42"
            + " directError=true inferredLine=" + diagnostic.inferredLine() + " sourceRetained=true");
        return ActionResult.pass("package-verify", "mode=source-replay packageCount=2 validResult=42"
            + " directError=true inferredLine=" + diagnostic.inferredLine() + " sourceRetained=true");
    }

    static String readInvalidBodySource(Connection c) throws SQLException {
        try (var s = c.createStatement()) {
            s.setQueryTimeout(10);
            try (var r = s.executeQuery("SELECT s.src FROM dbe_pldeveloper.gs_source s"
                + " JOIN pg_namespace n ON n.oid=s.nspid"
                + " WHERE n.nspname='" + SCHEMA + "' AND lower(s.name::text)='gui_bad'"
                + " AND lower(s.type)='package body' AND NOT s.status")) {
                if (!r.next()) return null;
                String source = r.getString(1);
                if (r.next()) throw new IllegalStateException("Multiple invalid package body source rows found");
                return source;
            }
        }
    }

    static Diagnostic validateDirectDiagnostic(SQLException error, String source) {
        String message = oneLine(error.getMessage());
        if (message.isBlank()) throw new IllegalStateException("Server returned an empty package diagnostic", error);
        if (!message.toLowerCase(java.util.Locale.ROOT).contains("no_such_table")) {
            throw new IllegalStateException("Direct package diagnostic does not identify the invalid type", error);
        }
        int inferredLine = lineOf(source, BAD_TYPE_TOKEN);
        if (inferredLine <= 0) throw new IllegalStateException("Cannot infer invalid package source line", error);
        return new Diagnostic(nullSafe(error.getSQLState()), error.getErrorCode(), inferredLine, message);
    }

    static int lineOf(String source, String token) {
        String normalizedSource = source.toLowerCase(java.util.Locale.ROOT);
        String normalizedToken = token.toLowerCase(java.util.Locale.ROOT);
        int offset = normalizedSource.indexOf(normalizedToken);
        if (offset < 0 || normalizedSource.indexOf(normalizedToken, offset + normalizedToken.length()) >= 0) {
            return -1;
        }
        int line = 1;
        for (int index = 0; index < offset; index++) if (source.charAt(index) == '\n') line++;
        return line;
    }

    /** Keep this contract aligned with the production package compiler's source-replay rewrite. */
    static String asCreateOrReplace(String sql) {
        String source = sql == null ? "" : sql;
        int create = skipTrivia(source, 0);
        int createEnd = create + "CREATE".length();
        if (!matchesToken(source, create, "CREATE")) return source;
        int next = skipTrivia(source, createEnd);
        if (matchesToken(source, next, "OR")) {
            int replace = skipTrivia(source, next + "OR".length());
            int packageToken = skipTrivia(source, replace + "REPLACE".length());
            if (matchesToken(source, replace, "REPLACE") && matchesToken(source, packageToken, "PACKAGE")) {
                return source;
            }
            return source;
        }
        if (next > createEnd && matchesToken(source, next, "PACKAGE")) {
            return source.substring(0, createEnd) + " OR REPLACE" + source.substring(createEnd);
        }
        return source;
    }

    private static boolean matchesToken(String sql, int offset, String token) {
        int end = offset + token.length();
        return offset >= 0 && end <= sql.length()
            && sql.regionMatches(true, offset, token, 0, token.length())
            && (end == sql.length() || !Character.isJavaIdentifierPart(sql.charAt(end)));
    }

    private static int skipTrivia(String sql, int offset) {
        while (offset < sql.length()) {
            if (Character.isWhitespace(sql.charAt(offset))) {
                offset++;
            } else if (sql.startsWith("--", offset)) {
                while (offset < sql.length() && sql.charAt(offset) != '\n' && sql.charAt(offset) != '\r') {
                    offset++;
                }
            } else if (sql.startsWith("/*", offset)) {
                int depth = 1;
                offset += 2;
                while (offset < sql.length() && depth > 0) {
                    if (sql.startsWith("/*", offset)) {
                        depth++;
                        offset += 2;
                    } else if (sql.startsWith("*/", offset)) {
                        depth--;
                        offset += 2;
                    } else {
                        offset++;
                    }
                }
            } else {
                break;
            }
        }
        return offset;
    }

    record Diagnostic(String sqlState, int vendorCode, int inferredLine, String message) {}

    record ActionResult(String status, String test, String reason, String details) {
        static ActionResult pass(String test, String details) {
            return new ActionResult("PASS", test, "none", details);
        }

        static ActionResult unsupported(String test, String reason, String details) {
            return new ActionResult("UNSUPPORTED", test, reason, details);
        }

        boolean isPass() {
            return status.equals("PASS");
        }

        ActionResult withDetails(String replacement) {
            return new ActionResult(status, test, reason, replacement);
        }
    }

    static void printResult(ActionResult result) {
        System.out.println("RESULT " + result.status() + " test=" + result.test()
            + " reason=" + result.reason() + " " + result.details());
    }

    private static String oneLine(String value) {
        if (value == null) return "";
        String compact = value.replaceAll("\\s+", " ").trim();
        return compact.length() <= 300 ? compact : compact.substring(0, 300) + "...";
    }

    private static String nullSafe(String value) {
        return value == null || value.isBlank() ? "none" : value;
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
