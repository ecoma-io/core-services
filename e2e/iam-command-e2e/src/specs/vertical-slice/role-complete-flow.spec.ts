import axios from 'axios';
import { TestEnvironment } from '../../support/test.environment';

interface Context {
  commandUrl: string;
  queryUrl: string;
}

/**
 * E2E Test: Role Vertical Slice - Complete CQRS Flow
 *
 * Validates the complete flow:
 * 1. Command Service: CreateRole → EventStoreDB + RabbitMQ
 * 2. Projector Worker: Consume event → Update read model
 * 3. Query Service: GET /roles/:id → Read from PostgreSQL
 *
 * This test verifies:
 * - Command side execution (write)
 * - Event publication
 * - Projection (eventual consistency)
 * - Query side execution (read)
 * - Read Your Own Writes (RYOW) pattern
 * - Role is scoped to tenant
 */
describe('Vertical Slice - Role Complete Flow', () => {
  const environment = new TestEnvironment();
  let context: Context;
  let tenantId: string;

  beforeAll(async () => {
    await environment.start();
    context = {
      commandUrl: `http://localhost:${environment.commandServicePort}`,
      queryUrl: `http://localhost:${environment.queryServicePort}`,
    };

    // Create a tenant first for role scoping
    const tenantRes = await axios.post(
      `${context.commandUrl}/commands/create-tenant`,
      {
        name: 'Role Test Corp',
        namespace: 'role-test',
        metadata: { purpose: 'e2e-role-test' },
      }
    );
    tenantId = tenantRes.data.tenantId;

    // Wait for tenant projection
    const maxWaitMs = 5000;
    const pollIntervalMs = 250;
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
      try {
        const res = await axios.get(`${context.queryUrl}/tenants/${tenantId}`);
        if (res.status === 200) break;
      } catch (err: any) {
        if (err?.response?.status !== 404) throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }, 120000); // 2 minutes for starting 3 services

  afterAll(async () => {
    await environment.stop();
  }, 30000);

  /**
   * Main vertical slice test:
   * CreateRole command → Wait for projection → Query role
   */
  it('should create role via command and read it back via query', async () => {
    // Step 1: Send CreateRole command
    const createPayload = {
      tenantId: tenantId,
      name: 'Admin',
      permissionKeys: [
        'admin:user:read',
        'admin:user:write',
        'admin:tenant:manage',
      ],
    };

    const cmdRes = await axios.post(
      `${context.commandUrl}/commands/create-role`,
      createPayload
    );

    expect(cmdRes.status).toBe(202);
    expect(cmdRes.data.roleId).toBeDefined();
    expect(cmdRes.data.streamVersion).toBe(0);

    const { roleId } = cmdRes.data;

    // Step 2: Wait for projection (RYOW pattern)
    // Poll read model to ensure projection has completed
    const maxWaitMs = 5000; // 5 seconds max wait
    const pollIntervalMs = 250;
    const startTime = Date.now();
    let roleFound = false;

    while (Date.now() - startTime < maxWaitMs) {
      try {
        const queryRes = await axios.get(`${context.queryUrl}/roles/${roleId}`);
        if (queryRes.status === 200) {
          roleFound = true;

          // Step 3: Verify query response
          expect(queryRes.data).toMatchObject({
            roleId: roleId,
            tenantId: tenantId,
            name: 'Admin',
            permissionKeys: [
              'admin:user:read',
              'admin:user:write',
              'admin:tenant:manage',
            ],
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

    expect(roleFound).toBe(true);
  }, 15000); // 15 seconds timeout for this test

  /**
   * Negative test: Query for non-existent role
   */
  it('should return 404 for non-existent role', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';

    await expect(
      axios.get(`${context.queryUrl}/roles/${fakeId}`)
    ).rejects.toMatchObject({
      response: {
        status: 404,
      },
    });
  });

  /**
   * Test: Verify query service is responsive
   */
  it('GET /health/liveness -> 200 on query service', async () => {
    const res = await axios.get(`${context.queryUrl}/health/liveness`);
    expect(res.status).toBe(200);
    expect(res.data.message).toBe('Service still alive');
  });
});
