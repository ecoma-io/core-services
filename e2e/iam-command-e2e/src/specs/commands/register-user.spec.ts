import axios from 'axios';
import { TestEnvironment } from '../../support/test.environment';

interface Context {
  baseUrl: string;
}

/**
 * Test suite for register-user command endpoint.
 * Validates real handler behavior for POST /commands/register-user.
 *
 * Verifies 202 responses, required fields, and basic performance.
 * Future work: verify EventStoreDB persistence and RabbitMQ publishing side effects.
 */
describe('Commands - Register User', () => {
  const environment = new TestEnvironment();
  let context: Context;

  /**
   * Sets up the test environment before running tests.
   * @param {number} timeout - Timeout in milliseconds.
   */
  beforeAll(async () => {
    await environment.start();
    context = {
      baseUrl: `http://localhost:${environment.resourceServiceContainer.getMappedPort(3000)}`,
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
   * Tests successful register-user command with valid payload.
   */
  it('POST /commands/register-user -> 202 with valid payload', async () => {
    // Arrange: Valid user registration data
    const payload = {
      email: 'test@example.com',
      password: 'Str0ngP@ss!',
      firstName: 'Test',
      lastName: 'User',
    };

    // Act: Send register-user command
    const res = await axios.post(
      `${context.baseUrl}/commands/register-user`,
      payload
    );

    // Assert: Verify 202 Accepted and response contains command metadata
    expect(res.status).toBe(202);
    expect(res.data).toBeDefined();
    expect(typeof res.data.userId).toBe('string');
    expect(typeof res.data.streamVersion).toBe('number');
  });

  /**
   * Tests register-user with minimal payload.
   */
  it('POST /commands/register-user -> 202 with minimal data', async () => {
    // Arrange: Minimal registration data
    const payload = {
      email: 'minimal@test.com',
      password: 'Str0ngP@ss!',
    };

    // Act: Send command
    const res = await axios.post(
      `${context.baseUrl}/commands/register-user`,
      payload
    );

    // Assert: Command accepted
    expect(res.status).toBe(202);
    expect(typeof res.data.userId).toBe('string');
    expect(typeof res.data.streamVersion).toBe('number');
  });

  /**
   * Tests register-user with empty body.
   * NOTE: Placeholder implementation may not validate - update when validation is added.
   */
  it('POST /commands/register-user -> 422 with empty body', async () => {
    // Arrange: Empty payload
    const payload = {};

    // Act + Assert: Expect validation error
    await expect(
      axios.post(`${context.baseUrl}/commands/register-user`, payload)
    ).rejects.toMatchObject({
      response: { status: 422 },
    });
  });

  /**
   * Tests concurrent register-user commands.
   * Verifies the endpoint can handle parallel requests without errors.
   */
  it('POST /commands/register-user -> handles concurrent requests', async () => {
    // Arrange: Create multiple payloads
    const requestCount = 10;
    const requests = Array.from({ length: requestCount }, (_, i) =>
      axios.post(`${context.baseUrl}/commands/register-user`, {
        email: `concurrent${i}@test.com`,
        password: 'Str0ngP@ss!',
        firstName: 'User',
        lastName: `${i}`,
      })
    );

    // Act: Execute all requests concurrently
    const results = await Promise.all(requests);

    // Assert: All requests should succeed with 202
    results.forEach((res) => {
      expect(res.status).toBe(202);
      expect(typeof res.data.userId).toBe('string');
      expect(typeof res.data.streamVersion).toBe('number');
    });
  });

  /**
   * Performance sanity check: register-user should respond reasonably fast.
   */
  it('POST /commands/register-user -> responds within acceptable time', async () => {
    // Arrange: Valid payload and start timer
    const payload = {
      email: 'perf@test.com',
      password: 'Str0ngP@ss!',
      firstName: 'Perf',
      lastName: 'User',
    };
    const startTime = Date.now();

    // Act: Send command
    const res = await axios.post(
      `${context.baseUrl}/commands/register-user`,
      payload
    );
    const responseTime = Date.now() - startTime;

    // Assert: Should respond reasonably fast for real handler
    expect(res.status).toBe(202);
    expect(responseTime).toBeLessThan(4000); // Allow 4s to avoid flakiness in CI containers
  });

  /**
   * Edge Case: Tests register-user with special characters in name and email.
   */
  it('POST /commands/register-user -> accepts special characters', async () => {
    // Arrange: Payload with special characters
    const payload = {
      email: 'user+test@example.co.uk',
      password: 'Str0ngP@ss!',
      firstName: "O'Brien-Smith",
      lastName: 'Senior',
    };

    // Act: Send command
    const res = await axios.post(
      `${context.baseUrl}/commands/register-user`,
      payload
    );

    // Assert: Should accept
    expect(res.status).toBe(202);
    expect(typeof res.data.userId).toBe('string');
    expect(typeof res.data.streamVersion).toBe('number');
  });

  /**
   * Edge Case: Tests register-user with very long strings.
   */
  it('POST /commands/register-user -> handles long strings', async () => {
    // Arrange: Payload with long strings
    const longEmail = 'a'.repeat(64) + '@example.com';
    const longFirst = 'Very Long FirstName '.repeat(10);
    const longLast = 'Very Long LastName '.repeat(10);
    const payload = {
      email: longEmail,
      password: 'Str0ngP@ss!',
      firstName: longFirst,
      lastName: longLast,
    };

    // Act: Send command
    const res = await axios.post(
      `${context.baseUrl}/commands/register-user`,
      payload
    );

    // Assert: Should accept
    expect(res.status).toBe(202);
    expect(typeof res.data.userId).toBe('string');
    expect(typeof res.data.streamVersion).toBe('number');
  });

  /**
   * Edge Case: Tests register-user with unicode characters.
   */
  it('POST /commands/register-user -> handles unicode characters', async () => {
    // Arrange: Payload with unicode
    const payload = {
      email: 'tester@example.jp',
      password: 'Str0ngP@ss!',
      firstName: 'Søren',
      lastName: 'Müller 山田',
    };

    // Act: Send command
    const res = await axios.post(
      `${context.baseUrl}/commands/register-user`,
      payload
    );

    // Assert: Should handle unicode correctly
    expect(res.status).toBe(202);
    expect(typeof res.data.userId).toBe('string');
    expect(typeof res.data.streamVersion).toBe('number');
  });

  /**
   * Edge Case: Tests register-user with extra fields in payload.
   */
  it('POST /commands/register-user -> handles extra fields gracefully', async () => {
    // Arrange: Payload with extra unknown fields
    const payload = {
      email: 'extra@test.com',
      password: 'Str0ngP@ss!',
      firstName: 'Extra',
      lastName: 'Fields',
      role: 'admin', // Extra field
      permissions: ['read', 'write'], // Extra field
    };

    // Act: Send command
    const res = await axios.post(
      `${context.baseUrl}/commands/register-user`,
      payload
    );

    // Assert: Should accept (unknown fields ignored)
    expect(res.status).toBe(202);
    expect(typeof res.data.userId).toBe('string');
    expect(typeof res.data.streamVersion).toBe('number');
  });
});
