import java.sql.SQLException;

/** Offline contract for structured versus source-replay package diagnostics. */
public class GuiPackageDegradedCapabilityContractTest {
    public static void main(String[] args) {
        expect(GuiPackageFixture.PackageMode.STRUCTURED,
            capability("Centralized", "A", true, true, true, true, true).mode());
        expect(GuiPackageFixture.PackageMode.SOURCE_REPLAY,
            capability("Distribute", "ORA", true, false, false, false, true).mode());
        expect(GuiPackageFixture.PackageMode.SOURCE_REPLAY,
            capability("Distribute", "O", true, true, false, false, true).mode());
        expect(GuiPackageFixture.PackageMode.UNSUPPORTED,
            capability("Distribute", "M", true, false, false, false, true).mode());
        expect(GuiPackageFixture.PackageMode.UNSUPPORTED,
            capability("Distribute", "ORA", true, false, false, false, false).mode());
        expect(3, GuiPackageFixture.lineOf(GuiPackageFixture.BAD_BODY_SQL, GuiPackageFixture.BAD_TYPE_TOKEN));
        expect(-1, GuiPackageFixture.lineOf(
            GuiPackageFixture.BAD_BODY_SQL + "\n-- " + GuiPackageFixture.BAD_TYPE_TOKEN,
            GuiPackageFixture.BAD_TYPE_TOKEN));

        expect("-- package source\nCREATE OR REPLACE PACKAGE p AS END p;",
            GuiPackageFixture.asCreateOrReplace("-- package source\nCREATE PACKAGE p AS END p;"));
        expect("/* source */ CREATE OR REPLACE PACKAGE BODY p AS END p;",
            GuiPackageFixture.asCreateOrReplace("/* source */ CREATE PACKAGE BODY p AS END p;"));
        expect("/* outer /* nested */ source */ CREATE OR REPLACE PACKAGE p AS END p;",
            GuiPackageFixture.asCreateOrReplace(
                "/* outer /* nested */ source */ CREATE PACKAGE p AS END p;"));
        expect("CREATE OR /* retained */ REPLACE PACKAGE p AS END p;",
            GuiPackageFixture.asCreateOrReplace(
                "CREATE OR /* retained */ REPLACE PACKAGE p AS END p;"));
        expect("CREATE PACKAGES p AS END p;",
            GuiPackageFixture.asCreateOrReplace("CREATE PACKAGES p AS END p;"));
        expect("SELECT 'CREATE PACKAGE p'",
            GuiPackageFixture.asCreateOrReplace("SELECT 'CREATE PACKAGE p'"));

        SQLException error = new SQLException(
            "ERROR: invalid type name dbv_pkg_gui_repeatable.no_such_table.id%TYPE", "42704", 11019);
        GuiPackageFixture.Diagnostic diagnostic =
            GuiPackageFixture.validateDirectDiagnostic(error, GuiPackageFixture.BAD_BODY_SQL);
        expect("42704", diagnostic.sqlState());
        expect(11019, diagnostic.vendorCode());
        expect(3, diagnostic.inferredLine());

        expectFailure(() -> GuiPackageFixture.validateDirectDiagnostic(
            new SQLException("generic compilation failure", "XX000", 1), GuiPackageFixture.BAD_BODY_SQL));
        expectFailure(() -> GuiPackageFixture.validateDirectDiagnostic(error, "CREATE PACKAGE BODY p AS END p;"));
        expectFailure(() -> GuiPackageFixture.validateDirectDiagnostic(error,
            GuiPackageFixture.BAD_BODY_SQL + "\n-- " + GuiPackageFixture.BAD_TYPE_TOKEN));
        System.out.println("PASS package degraded capability contract: 19 checks");
    }

    private static GuiPackageFixture.PackageCapability capability(
        String deployment,
        String compatibility,
        boolean packageCatalog,
        boolean forceCreateSetting,
        boolean showAllErrorSetting,
        boolean errorsCatalog,
        boolean sourceCatalog
    ) {
        return new GuiPackageFixture.PackageCapability(deployment, compatibility, packageCatalog,
            forceCreateSetting, showAllErrorSetting, errorsCatalog, sourceCatalog);
    }

    private static void expect(Object expected, Object actual) {
        if (!expected.equals(actual)) throw new AssertionError("Expected " + expected + " but got " + actual);
    }

    private static void expectFailure(Runnable action) {
        try {
            action.run();
        } catch (IllegalStateException expected) {
            return;
        }
        throw new AssertionError("Expected diagnostic validation failure");
    }
}
