/** Offline checks for package-fixture capability classification. */
public class GuiPackageCapabilityContractTest {
    public static void main(String[] args) {
        expect(true, capability("BusinessCentralized", "A", true, true, true, true, true));
        expect(true, capability("single-centralized", "ORA", true, true, true, true, true));
        expect(false, capability("Distributed", "ORA", true, true, true, true, true)
            || capability("not-centralized", "ORA", true, true, true, true, true));
        expect(false, capability("Centralized", "M", true, true, true, true, true));
        expect(false, capability("Centralized", "A", false, true, true, true, true));
        expect(false, capability("Centralized", "A", true, false, true, true, true));
        expect(false, capability("Centralized", "A", true, true, false, true, true));
        expect(false, capability("Centralized", "A", true, true, true, false, true));
        expect(false, capability("Centralized", "A", true, true, true, true, false));
        System.out.println("PASS package capability contract: 9 classifications");
    }

    private static boolean capability(
        String deployment,
        String compatibility,
        boolean packageCatalog,
        boolean forceCreateSetting,
        boolean showAllErrorSetting,
        boolean errorsCatalog,
        boolean sourceCatalog
    ) {
        return new GuiPackageFixture.PackageCapability(deployment, compatibility, packageCatalog,
            forceCreateSetting, showAllErrorSetting, errorsCatalog, sourceCatalog).supportsInvalidPackageBody();
    }

    private static void expect(boolean expected, boolean actual) {
        if (actual != expected) throw new AssertionError("Expected " + expected + " but got " + actual);
    }
}
