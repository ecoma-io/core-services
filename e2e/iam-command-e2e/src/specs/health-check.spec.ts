import axios from 'axios';
import { TestEnvironment } from '../support/test.environment';
import { ProxiedService } from '@ecoma-io/integration-hybridize';
import { DataSource } from 'typeorm';
import { S3Client } from '@aws-sdk/client-s3';

interface Context {
  baseUrl: string;
  postgresProxy: ProxiedService;
  minioProxy: ProxiedService;
  minioBucketName: string;
  postgres: {
    getHost(): string;
    getPort(): number;
    getUsername(): string;
    getPassword(): string;
    getDatabase(): string;
  };
}

/**
 * Test suite for health check endpoints in the resource service.
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
    const minio = (await environment.getMinio()) as ProxiedService & {
      bucketName: string;
      s3Client: S3Client;
    };
    context = {
      baseUrl: `http://localhost:${environment.resourceServiceContainer.getMappedPort(3000)}`,
      postgresProxy: postgres,
      minioProxy: minio,
      minioBucketName: minio.bucketName,
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
    const res = await axios.get(`${context.baseUrl}/health/liveness`);

    // Assert: Verify response status and data
    expect(res.status).toBe(200);
    expect(res.data).toEqual(expectedMessage);
  });

  /**
   * Tests the readiness health check endpoint when database and storage are up.
   */
  it('GET /health/readiness -> 200 with database UP', async () => {
    // Arrange: No specific setup needed beyond environment
    const expectedMessage = 'Service is ready';

    // Act: Make GET request to readiness endpoint
    const res = await axios.get(`${context.baseUrl}/health/readiness`);

    // Assert: Verify response status, message, and health of database and storage
    expect(res.status).toBe(200);
    expect(res.data?.message).toBe(expectedMessage);
    expect(res.data?.data?.database).toBeDefined();
    expect(String(res.data.data.database)).toBe('up');
    expect(res.data?.data?.storage).toBeDefined();
    expect(String(res.data.data.storage)).toBe('up');
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
      expect(data?.details?.storage).toBeDefined();
    } finally {
      // Cleanup: Re-enable proxy after test
      await context.postgresProxy.setEnabled(true);
    }
  });

  /**
   * Tests the readiness health check endpoint when S3 storage connection is down using ToxiProxy.
   */
  it('GET /health/readiness -> 503 when S3 storage connection is DOWN (ToxiProxy)', async () => {
    // Arrange: Disable Minio proxy to simulate storage failure
    await context.minioProxy.setEnabled(false);

    try {
      // Act: Attempt GET request to readiness endpoint, expecting failure
      await axios.get(`${context.baseUrl}/health/readiness`);

      // Assert: Fail the test if request succeeds unexpectedly
      fail('Expected request to fail, but it succeeded');
    } catch (error) {
      // Assert: Verify 503 status and error details for storage down
      const { status, data } = error.response;
      expect(status).toBe(503);
      expect(data?.message).toBe('Service is not ready');
      expect(data?.details?.storage).toBe('down');
      expect(data?.details?.database).toBeDefined();
    } finally {
      // Cleanup: Re-enable proxy after test
      await context.minioProxy.setEnabled(true);
    }
  });
});
