import java.util.HashSet;
import java.util.Properties;

/** Offline source/safety contract, with an optional two-database live lifecycle. */
public final class GuiDebugE2EFixtureTest {
    private GuiDebugE2EFixtureTest() {
    }

    public static void main(String[] args) throws Exception {
        offlineContract();
        if (args.length == 0) {
            System.out.println("PASS offline debugger E2E fixture source, scale and cleanup contracts");
            return;
        }
        if (args.length != 2 || !"YES".equals(System.getenv("GAUSSDB_HISTORY_ALLOW_DDL"))) {
            throw new IllegalArgumentException("Optional live test requires two config files and explicit DDL consent");
        }
        String[] setup = {"setup", args[0], args[1]};
        String[] verify = {"verify", args[0], args[1]};
        String[] cleanup = {"cleanup", args[0], args[1]};
        for (int round = 0; round < 2; round++) {
            boolean created = false;
            try {
                GuiDebugE2EFixture.main(setup);
                created = true;
                GuiDebugE2EFixture.main(verify);
                try {
                    GuiDebugE2EFixture.main(setup);
                    throw new AssertionError("Duplicate setup unexpectedly succeeded");
                } catch (java.sql.SQLException expected) {
                    if (!"42P06".equals(expected.getSQLState())) throw expected;
                }
            } finally {
                if (created) GuiDebugE2EFixture.main(cleanup);
            }
        }
        System.out.println("PASS two guarded live debugger E2E fixture lifecycles");
    }

    private static void offlineContract() {
        String sourceA = GuiDebugE2EFixture.largeLocalsSql(GuiDebugE2EFixture.DATABASE_A_TAG);
        String sourceB = GuiDebugE2EFixture.largeLocalsSql(GuiDebugE2EFixture.DATABASE_B_TAG);
        require(GuiDebugE2EFixture.lineCount(sourceA) >= 200, "large source line count");
        require(GuiDebugE2EFixture.declarationCount(sourceA) == GuiDebugE2EFixture.LOCAL_VARIABLES,
            "large source local-variable count");
        require(!sourceA.equals(sourceB), "database-specific large sources");
        require(sourceA.contains("v_database_tag integer := 101;"), "database A source tag");
        require(sourceB.contains("v_database_tag integer := 202;"), "database B source tag");
        String routineA = GuiDebugE2EFixture.sameNameSql(GuiDebugE2EFixture.DATABASE_A_TAG);
        String routineB = GuiDebugE2EFixture.sameNameSql(GuiDebugE2EFixture.DATABASE_B_TAG);
        require(routineA.contains(".same_name(p_seed integer)")
            && routineB.contains(".same_name(p_seed integer)"), "same routine name in both databases");
        require(!routineA.equals(routineB), "database-specific same-name routine sources");
        require(GuiDebugE2EFixture.waitSql().contains("pg_sleep(300)"), "running termination wait");
        require(GuiDebugE2EFixture.cleanupStatements().size() == 5, "exact cleanup statement count");
        require(new HashSet<>(GuiDebugE2EFixture.cleanupStatements()).size() == 5, "unique cleanup statements");
        for (String sql : GuiDebugE2EFixture.cleanupStatements()) {
            require(sql.endsWith(" RESTRICT"), "RESTRICT cleanup");
            require(!sql.toUpperCase().contains("CASCADE"), "no CASCADE cleanup");
        }
        Properties properties = new Properties();
        try {
            GuiDebugE2EFixture.required(properties, "driverClass");
            throw new AssertionError("Missing driverClass unexpectedly accepted");
        } catch (IllegalArgumentException expected) {
            require(expected.getMessage().contains("driverClass"), "explicit driver error");
        }
    }

    private static void require(boolean condition, String label) {
        if (!condition) throw new AssertionError("Fixture contract failed: " + label);
    }
}
