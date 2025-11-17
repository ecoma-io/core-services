import axios from 'axios';
import { TestEnvironment } from '../support/test.environment';
import { ProxiedService } from '@ecoma-io/integration-hybridize';
import { DataSource } from 'typeorm';

interface Context {
  baseUrl: string;
  postgresProxy: ProxiedService;
  redisProxy: ProxiedService;
  postgres: {
    getHost(): string;
    getPort(): number;
    getUsername(): string;
    getPassword(): string;
    getDatabase(): string;
  };
}

/**
 * Test suite for health check endpoints in the IAM command service.
 * This suite verifies liveness and readiness health checks, including scenarios with simulated failures using ToxiProxy.
 */
describe('Healthcheck', () => {
  const environment = new TestEnvironment();
  let context: Context;

  /**
   * Sets up the test environment with proxy before running tests.
   * @param {number} timeout - Timeout in milliseconds.
   */
  beforeAll(async () => {
    await environment.start();
    const postgres = (await environment.getPostgres()) as ProxiedService & {
      dataSource: DataSource;
      databaseName: string;
    };
    const redis = (await environment.getRedis()) as ProxiedService;
    context = {
      baseUrl: `http://localhost:${environment.resourceServiceContainer.getMappedPort(3000)}`,
      postgresProxy: postgres,
      redisProxy: redis,
      postgres: {
        getHost: () => postgres.host,
        getPort: () => postgres.port,
        getUsername: () => process.env['POSTGRES_USERNAME'] as string,
        getPassword: () => process.env['POSTGRES_PASSWORD'] as string,
        getDatabase: () => postgres.databaseName,
      },
    };
  }, 60000);

  /**
   * Tears down the test environment after running tests.
   * @param {number} timeout - Timeout in milliseconds.
   */
  afterAll(async () => {
    await environment.stop();
  }, 30000);

  /**
   * Tests the liveness health check endpoint.
   */
  it('GET /health/liveness -> 200', async () => {
    // Arrange: No specific setup needed beyond environment
    const expectedMessage = { message: 'Service still alive' };

    // Act: Make GET request to liveness endpoint
    try {
      const res = await axios.get(`${context.baseUrl}/health/liveness`);

      // Assert: Verify response status and data
      expect(res.status).toBe(200);
      expect(res.data).toEqual(expectedMessage);
    } catch (error) {
      // Debug: Print actual error to understand what's wrong
      console.error('Error response:', {
        status: error.response?.status,
        data: error.response?.data,
        headers: error.response?.headers,
      });
      throw error;
    }
  });

  /**
   * Tests the readiness health check endpoint when database is up.
   */
  it('GET /health/readiness -> 200 with database UP', async () => {
    // Arrange: No specific setup needed beyond environment
    const expectedMessage = 'Service is ready';

    // Act: Make GET request to readiness endpoint
    const res = await axios.get(`${context.baseUrl}/health/readiness`);

    // Assert: Verify response status, message, and health of database
    expect(res.status).toBe(200);
    expect(res.data?.message).toBe(expectedMessage);
    expect(res.data?.data?.database).toBeDefined();
    expect(String(res.data.data.database)).toBe('up');
  });

  /**
   * Tests the readiness health check endpoint when database connection is down using ToxiProxy.
   */
  it('GET /health/readiness -> 503 when database connection is DOWN (ToxiProxy)', async () => {
    // Arrange: Disable Postgres proxy to simulate database failure
    await context.postgresProxy.setEnabled(false);

    try {
      // Act: Attempt GET request to readiness endpoint, expecting failure
      await axios.get(`${context.baseUrl}/health/readiness`);

      // Assert: Fail the test if request succeeds unexpectedly
      fail('Expected request to fail, but it succeeded');
    } catch (error) {
      // Assert: Verify 503 status and error details for database down
      const { status, data } = error.response;
      expect(status).toBe(503);
      expect(data?.message).toBe('Service is not ready');
      expect(data?.details?.database).toBe('down');
    } finally {
      // Cleanup: Re-enable proxy after test
      await context.postgresProxy.setEnabled(true);
    }
  });

  /**
   * Edge Case: Tests readiness recovery after database comes back online.
   * Verifies that health check can recover from failure state.
   */
  it('GET /health/readiness -> recovers to 200 after database reconnects', async () => {
    // Arrange: Disable database to cause failure
    await context.postgresProxy.setEnabled(false);

    // Act 1: Verify service is unhealthy
    try {
      await axios.get(`${context.baseUrl}/health/readiness`);
      fail('Expected service to be unhealthy');
    } catch (error) {
      expect(error.response.status).toBe(503);
    }

    // Act 2: Re-enable database
    await context.postgresProxy.setEnabled(true);
    // Wait a bit for connection to re-establish
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Act 3: Verify service recovers
    const res = await axios.get(`${context.baseUrl}/health/readiness`);

    // Assert: Service should be healthy again
    expect(res.status).toBe(200);
    expect(res.data?.message).toBe('Service is ready');
    expect(String(res.data.data.database)).toBe('up');
  });

  /**
   * Edge Case: Tests liveness endpoint remains accessible even when database is down.
   * Liveness should not depend on external dependencies.
   */
  it('GET /health/liveness -> 200 even when database is DOWN', async () => {
    // Arrange: Disable database
    await context.postgresProxy.setEnabled(false);

    try {
      // Act: Request liveness endpoint
      const res = await axios.get(`${context.baseUrl}/health/liveness`);

      // Assert: Liveness should still return 200 (independent of database)
      expect(res.status).toBe(200);
      expect(res.data).toEqual({ message: 'Service still alive' });
    } finally {
      // Cleanup: Re-enable database
      await context.postgresProxy.setEnabled(true);
    }
  });

  /**
   * Edge Case: Tests concurrent readiness checks.
   * Verifies thread-safety and proper handling of parallel requests.
   */
  it('GET /health/readiness -> handles concurrent requests correctly', async () => {
    // Arrange: Prepare multiple concurrent requests
    const requestCount = 10;
    const requests = Array.from({ length: requestCount }, () =>
      axios.get(`${context.baseUrl}/health/readiness`)
    );

    // Act: Execute all requests concurrently
    const results = await Promise.all(requests);

    // Assert: All requests should succeed with consistent response
    results.forEach((res) => {
      expect(res.status).toBe(200);
      expect(res.data?.message).toBe('Service is ready');
      expect(String(res.data.data.database)).toBe('up');
    });
  });

  /**
   * Edge Case: Tests readiness check response structure consistency.
   * Verifies all required fields are present in healthy response.
   */
  it('GET /health/readiness -> returns complete response structure', async () => {
    // Act: Request readiness endpoint
    const res = await axios.get(`${context.baseUrl}/health/readiness`);

    // Assert: Verify complete response structure
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('message');
    expect(res.data).toHaveProperty('data');
    expect(res.data.data).toHaveProperty('database');
    expect(typeof res.data.message).toBe('string');
    expect(['up', 'down']).toContain(String(res.data.data.database));
  });

  /**
   * Edge Case: Tests liveness endpoint response time.
   * Liveness should be fast since it has no external dependencies.
   */
  it('GET /health/liveness -> responds quickly (< 100ms)', async () => {
    // Arrange: Record start time
    const startTime = Date.now();

    // Act: Request liveness endpoint
    const res = await axios.get(`${context.baseUrl}/health/liveness`);
    const responseTime = Date.now() - startTime;

    // Assert: Verify fast response
    expect(res.status).toBe(200);
    expect(responseTime).toBeLessThan(100);
  });

  /**
   * Edge Case: Tests readiness with multiple rapid requests during database recovery.
   * Simulates scenarios where database is flapping.
   */
  it('GET /health/readiness -> handles rapid state changes gracefully', async () => {
    // Arrange & Act: Rapidly toggle database state
    await context.postgresProxy.setEnabled(false);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await context.postgresProxy.setEnabled(true);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await context.postgresProxy.setEnabled(false);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await context.postgresProxy.setEnabled(true);
    await new Promise((resolve) => setTimeout(resolve, 500)); // Wait for stabilization

    // Act: Request readiness after state changes
    const res = await axios.get(`${context.baseUrl}/health/readiness`);

    // Assert: Service should eventually report correct state
    expect(res.status).toBe(200);
    expect(String(res.data.data.database)).toBe('up');
  });
});
