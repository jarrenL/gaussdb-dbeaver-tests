import java.util.Properties;

/** Offline fail-closed contract for centralized review endpoint and deployment binding. */
public final class IsolatedReviewDatabaseContractTest {
    private static final String INSTANCE_ID = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    private static final String DATABASE = "review_0917_50520080_ora";
    private static final String ENDPOINT = "example.invalid:8000";
    private int passed;

    public static void main(String[] args) {
        new IsolatedReviewDatabaseContractTest().run();
    }

    private void run() {
        Properties valid = validProperties();
        require(IsolatedReviewDatabase.endpointBinding(INSTANCE_ID, ENDPOINT).equals(
            IsolatedReviewDatabase.requireConnectionBinding(valid, DATABASE)),
            "matching instance endpoint binding is accepted");

        Properties endpoint = copy(valid);
        endpoint.setProperty("review.endpoint", "other.invalid:8000");
        requireRejected(endpoint, "endpoint metadata substitution is rejected");

        Properties url = copy(valid);
        url.setProperty("url", "jdbc:gaussdb://other.invalid:8000/" + DATABASE);
        requireRejected(url, "JDBC endpoint substitution is rejected");

        Properties instance = copy(valid);
        instance.setProperty("instanceId", "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
        requireRejected(instance, "instance identity substitution is rejected");

        Properties credentials = copy(valid);
        credentials.setProperty("url", credentials.getProperty("url") + "?pass%77ord=secret");
        requireRejected(credentials, "JDBC URL query credentials are rejected");

        Properties digest = copy(valid);
        digest.setProperty("review.endpointBinding", "0".repeat(64));
        requireRejected(digest, "endpoint digest substitution is rejected");

        Properties deployment = copy(valid);
        deployment.setProperty("review.deployment", "distributed");
        requireRejected(deployment, "distributed review metadata is rejected");

        require(IsolatedReviewDatabase.isCentralizedDeployment("centralized"),
            "centralized server deployment is accepted");
        require(IsolatedReviewDatabase.isCentralizedDeployment(" Centralized "),
            "centralized server deployment comparison is case and whitespace tolerant");
        require(IsolatedReviewDatabase.isCentralizedDeployment("BusinessCentralized"),
            "business-centralized server deployment is accepted");
        require(IsolatedReviewDatabase.isCentralizedDeployment("single-centralized"),
            "single-centralized server deployment is accepted");
        require(!IsolatedReviewDatabase.isCentralizedDeployment("distributed")
                && !IsolatedReviewDatabase.isCentralizedDeployment("not-centralized")
                && !IsolatedReviewDatabase.isCentralizedDeployment(null),
            "non-centralized server deployment is rejected");

        System.out.println("TOTAL CHECKS " + passed + " PASS " + passed + " FAIL 0");
        if (passed != 12) throw new AssertionError("Expected 12 centralized binding checks");
    }

    private static Properties validProperties() {
        Properties properties = new Properties();
        properties.setProperty("url", "jdbc:gaussdb://example.invalid:8000/" + DATABASE);
        properties.setProperty("instanceId", INSTANCE_ID);
        properties.setProperty("review.endpoint", ENDPOINT);
        properties.setProperty("review.deployment", "centralized");
        properties.setProperty("review.endpointBinding",
            IsolatedReviewDatabase.endpointBinding(INSTANCE_ID, ENDPOINT));
        return properties;
    }

    private static Properties copy(Properties source) {
        Properties copy = new Properties();
        copy.putAll(source);
        return copy;
    }

    private void requireRejected(Properties properties, String label) {
        try {
            IsolatedReviewDatabase.requireConnectionBinding(properties, DATABASE);
            throw new AssertionError(label);
        } catch (IllegalArgumentException expected) {
            require(true, label);
        }
    }

    private void require(boolean condition, String label) {
        if (!condition) throw new AssertionError(label);
        passed++;
        System.out.println("PASS " + label);
    }
}
