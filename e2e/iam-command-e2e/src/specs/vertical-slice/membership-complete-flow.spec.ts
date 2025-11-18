import axios from 'axios';
import { v7 as uuidv7 } from 'uuid';
import { TestEnvironment } from '../../support/test.environment';

interface Context {
  commandUrl: string;
  queryUrl: string;
}

/**
 * E2E Test: Membership Vertical Slice - Complete CQRS Flow
 *
 * Validates the complete flow:
 * 1. Command Service: CreateMembership → EventStoreDB + RabbitMQ
 * 2. Projector Worker: Consume event → Update read model
 * 3. Query Service: GET /memberships/:id → Read from PostgreSQL
 *
 * This test verifies:
 * - Command side execution (write)
 * - Event publication
 * - Projection (eventual consistency)
 * - Query side execution (read)
 * - Read Your Own Writes (RYOW) pattern
 * - Multi-tenancy: Membership links user to tenant
 */
describe('Vertical Slice - Membership Complete Flow', () => {
  const environment = new TestEnvironment();
  let context: Context;
  let tenantId: string;
  let userId: string;

  beforeAll(async () => {
    await environment.start();
    context = {
      commandUrl: `http://localhost:${environment.commandServicePort}`,
      queryUrl: `http://localhost:${environment.queryServicePort}`,
    };

    // Create a tenant first
    const tenantRes = await axios.post(
      `${context.commandUrl}/commands/create-tenant`,
      {
        name: 'Membership Test Corp',
        namespace: 'membership-test',
        metadata: { purpose: 'e2e-membership-test' },
      }
    );
    tenantId = tenantRes.data.tenantId;

    // Create a user
    const userRes = await axios.post(
      `${context.commandUrl}/commands/register-user`,
      {
        email: 'member@test.com',
        password: 'SecurePass123!',
        firstName: 'Member',
        lastName: 'Tester',
      }
    );
    userId = userRes.data.userId;

    // Wait for tenant and user projections
    const maxWaitMs = 5000;
    const pollIntervalMs = 250;

    // Wait for tenant
    let startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
      try {
        const res = await axios.get(`${context.queryUrl}/tenants/${tenantId}`);
        if (res.status === 200) break;
      } catch (err: any) {
        if (err?.response?.status !== 404) throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    // Wait for user
    startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
      try {
        const res = await axios.get(`${context.queryUrl}/users/${userId}`);
        if (res.status === 200) break;
      } catch (err: any) {
        if (err?.response?.status !== 404) throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }, 120000); // 2 minutes for starting 3 services + creating dependencies

  afterAll(async () => {
    await environment.stop();
  }, 30000);

  /**
   * Main vertical slice test:
   * CreateMembership command → Wait for projection → Query membership
   */
  it('should create membership via command and read it back via query', async () => {
    // Step 1: Send CreateMembership command
    const membershipId = uuidv7();
    const createPayload = {
      membershipId: membershipId,
      userId: userId,
      tenantId: tenantId,
    };

    const cmdRes = await axios.post(
      `${context.commandUrl}/commands/create-membership`,
      createPayload
    );

    expect(cmdRes.status).toBe(202);
    expect(cmdRes.data.membershipId).toBe(membershipId);
    expect(cmdRes.data.streamVersion).toBe(0);

    // Step 2: Wait for projection (RYOW pattern)
    // Poll read model to ensure projection has completed
    const maxWaitMs = 5000; // 5 seconds max wait
    const pollIntervalMs = 250;
    const startTime = Date.now();
    let membershipFound = false;

    while (Date.now() - startTime < maxWaitMs) {
      try {
        const queryRes = await axios.get(
          `${context.queryUrl}/memberships/${membershipId}`
        );
        if (queryRes.status === 200) {
          membershipFound = true;

          // Step 3: Verify query response
          expect(queryRes.data).toMatchObject({
            membershipId: membershipId,
            userId: userId,
            tenantId: tenantId,
            roleIds: [], // No roles assigned yet
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

    expect(membershipFound).toBe(true);
  }, 20000); // 20 seconds timeout for this test

  /**
   * Negative test: Query for non-existent membership
   */
  it('should return 404 for non-existent membership', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';

    await expect(
      axios.get(`${context.queryUrl}/memberships/${fakeId}`)
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
