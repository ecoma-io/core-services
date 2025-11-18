import axios from 'axios';
import { TestEnvironment } from '../../support/test.environment';

interface Context {
  commandUrl: string;
  queryUrl: string;
}

/**
 * E2E Test: Tenant Vertical Slice - Complete CQRS Flow
 *
 * Validates the complete flow:
 * 1. Command Service: CreateTenant → EventStoreDB + RabbitMQ
 * 2. Projector Worker: Consume event → Update read model
 * 3. Query Service: GET /tenants/:id → Read from PostgreSQL
 *
 * This test verifies:
 * - Command side execution (write)
 * - Event publication
 * - Projection (eventual consistency)
 * - Query side execution (read)
 * - Read Your Own Writes (RYOW) pattern
 */
describe('Vertical Slice - Tenant Complete Flow', () => {
  const environment = new TestEnvironment();
  let context: Context;

  beforeAll(async () => {
    await environment.start();
    context = {
      commandUrl: `http://localhost:${environment.commandServicePort}`,
      queryUrl: `http://localhost:${environment.queryServicePort}`,
    };
  }, 120000); // 2 minutes for starting 2 services

  afterAll(async () => {
    await environment.stop();
  }, 30000);

  /**
   * Main vertical slice test:
   * CreateTenant command → Wait for projection → Query tenant
   */
  it('should create tenant via command and read it back via query', async () => {
    // Step 1: Send CreateTenant command
    const createPayload = {
      name: 'E2E Vertical Corp',
      namespace: 'e2e-vertical',
      metadata: {
        tier: 'enterprise',
        region: 'us-east',
        features: ['sso', 'audit'],
      },
    };

    const cmdRes = await axios.post(
      `${context.commandUrl}/commands/create-tenant`,
      createPayload
    );

    expect(cmdRes.status).toBe(202);
    expect(cmdRes.data.tenantId).toBeDefined();
    expect(cmdRes.data.streamVersion).toBe(0);

    const { tenantId } = cmdRes.data;

    // Step 2: Wait for projection (RYOW pattern)
    // Poll read model to ensure projection has completed
    const maxWaitMs = 5000; // 5 seconds max wait
    const pollIntervalMs = 250;
    const startTime = Date.now();
    let tenantFound = false;

    while (Date.now() - startTime < maxWaitMs) {
      try {
        const queryRes = await axios.get(
          `${context.queryUrl}/tenants/${tenantId}`
        );
        if (queryRes.status === 200) {
          tenantFound = true;

          // Step 3: Verify query response
          expect(queryRes.data).toMatchObject({
            id: tenantId,
            name: 'E2E Vertical Corp',
            namespace: 'e2e-vertical',
            metadata: {
              tier: 'enterprise',
              region: 'us-east',
              features: ['sso', 'audit'],
            },
          });
          expect(queryRes.data.createdAt).toBeDefined();
          expect(queryRes.data.updatedAt).toBeDefined();
          break;
        }
      } catch (err: any) {
        // 404 is expected while projection is in progress
        if (err?.response?.status !== 404) {
          throw err;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    expect(tenantFound).toBe(true);
  }, 15000); // 15 seconds timeout for this test

  /**
   * Negative test: Query for non-existent tenant
   */
  it('should return 404 for non-existent tenant', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';

    await expect(
      axios.get(`${context.queryUrl}/tenants/${fakeId}`)
    ).rejects.toMatchObject({
      response: {
        status: 404,
      },
    });
  });

  /**
   * Test: Health endpoint of query service
   */
  it('GET /health/liveness -> 200 on query service', async () => {
    const res = await axios.get(`${context.queryUrl}/health/liveness`);
    expect(res.status).toBe(200);
    expect(res.data.message).toBe('Service still alive');
  });
});
