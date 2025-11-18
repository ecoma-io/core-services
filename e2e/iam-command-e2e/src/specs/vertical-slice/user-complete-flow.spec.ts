import axios from 'axios';
import { TestEnvironment } from '../../support/test.environment';

interface Context {
  commandUrl: string;
  queryUrl: string;
}

/**
 * E2E Test: User Vertical Slice - Complete CQRS Flow
 *
 * Validates the complete flow:
 * 1. Command Service: RegisterUser → EventStoreDB + RabbitMQ
 * 2. Projector Worker: Consume event → Update read model
 * 3. Query Service: GET /users/:id → Read from PostgreSQL
 *
 * This test verifies:
 * - Command side execution (write)
 * - Event publication
 * - Projection (eventual consistency)
 * - Query side execution (read)
 * - Read Your Own Writes (RYOW) pattern
 */
describe('Vertical Slice - User Complete Flow', () => {
  const environment = new TestEnvironment();
  let context: Context;

  beforeAll(async () => {
    await environment.start();
    context = {
      commandUrl: `http://localhost:${environment.commandServicePort}`,
      queryUrl: `http://localhost:${environment.queryServicePort}`,
    };
  }, 120000); // 2 minutes for starting 3 services

  afterAll(async () => {
    await environment.stop();
  }, 30000);

  /**
   * Main vertical slice test:
   * RegisterUser command → Wait for projection → Query user
   */
  it('should register user via command and read it back via query', async () => {
    // Step 1: Send RegisterUser command
    const createPayload = {
      email: 'vertical-test@example.com',
      password: 'SecurePass123!',
      firstName: 'Vertical',
      lastName: 'Slice',
    };

    const cmdRes = await axios.post(
      `${context.commandUrl}/commands/register-user`,
      createPayload
    );

    expect(cmdRes.status).toBe(202);
    expect(cmdRes.data.userId).toBeDefined();
    expect(cmdRes.data.streamVersion).toBe(0);

    const { userId } = cmdRes.data;

    // Step 2: Wait for projection (RYOW pattern)
    // Poll read model to ensure projection has completed
    const maxWaitMs = 5000; // 5 seconds max wait
    const pollIntervalMs = 250;
    const startTime = Date.now();
    let userFound = false;

    while (Date.now() - startTime < maxWaitMs) {
      try {
        const queryRes = await axios.get(`${context.queryUrl}/users/${userId}`);
        if (queryRes.status === 200) {
          userFound = true;

          // Step 3: Verify query response
          expect(queryRes.data).toMatchObject({
            userId: userId,
            email: 'vertical-test@example.com',
            firstName: 'Vertical',
            lastName: 'Slice',
          });
          expect(queryRes.data.createdAt).toBeDefined();
          // Password should NOT be in query response
          expect(queryRes.data.password).toBeUndefined();
          expect(queryRes.data.passwordHash).toBeUndefined();
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

    expect(userFound).toBe(true);
  }, 15000); // 15 seconds timeout for this test

  /**
   * Negative test: Query for non-existent user
   */
  it('should return 404 for non-existent user', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';

    await expect(
      axios.get(`${context.queryUrl}/users/${fakeId}`)
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
