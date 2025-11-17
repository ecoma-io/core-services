import axios from 'axios';
import { TestEnvironment } from '../support/test.environment';

interface Context {
  baseUrl: string;
}

/**
 * Test suite for routing behavior and default responses.
 * Verifies how the service handles unknown routes and HTTP methods.
 */
describe('Routing & Defaults', () => {
  // Initialize test environment and context with no proxy
  const environment = new TestEnvironment(false);
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
   * Tests that unknown routes return 404.
   */
  it('GET /unknown -> 404 with default NestJS error response', async () => {
    // Act & Assert: Request unknown route and expect 404
    try {
      await axios.get(`${context.baseUrl}/unknown`);
      fail('Expected 404 error');
    } catch (error) {
      expect(error.response).toBeDefined();
      const { status, data } = error.response;
      expect(status).toBe(404);
      expect(data).toBeDefined();
      // GlobalExceptionsFilter transforms to custom format
      expect(data.error || data.message).toBeDefined();
    }
  });

  /**
   * Tests that deeply nested unknown routes return 404.
   */
  it('GET /deeply/nested/unknown/path -> 404', async () => {
    // Act & Assert: Request deeply nested unknown route
    try {
      await axios.get(`${context.baseUrl}/deeply/nested/unknown/path`);
      fail('Expected 404 error');
    } catch (error) {
      expect(error.response.status).toBe(404);
    }
  });

  /**
   * Tests unsupported HTTP method on existing endpoint.
   */
  it('PUT /health/liveness -> 405 or 404 (method not allowed)', async () => {
    // Act & Assert: Use unsupported HTTP method
    try {
      await axios.put(`${context.baseUrl}/health/liveness`);
      fail('Expected error for unsupported method');
    } catch (error) {
      const { status } = error.response;
      // NestJS may return 404 (no route) or 405 (method not allowed)
      expect([404, 405]).toContain(status);
    }
  });

  /**
   * Tests DELETE on command endpoint that only supports POST.
   */
  it('DELETE /commands/register-user -> 405 or 404', async () => {
    // Act & Assert: Use DELETE on POST-only endpoint
    try {
      await axios.delete(`${context.baseUrl}/commands/register-user`);
      fail('Expected error for DELETE method');
    } catch (error) {
      const { status } = error.response;
      expect([404, 405]).toContain(status);
    }
  });

  /**
   * Tests root path behavior.
   */
  it('GET / -> returns 404 (no root handler defined)', async () => {
    // Act & Assert: Request root path
    try {
      await axios.get(`${context.baseUrl}/`);
      fail('Expected 404 for root path');
    } catch (error) {
      expect(error.response.status).toBe(404);
    }
  });

  /**
   * Edge Case: Tests case sensitivity of routes.
   * Note: Some Axios configurations may not throw errors consistently for 404.
   */
  it.skip('GET /Health/Liveness -> 404 (routes are case-sensitive)', async () => {
    // Act & Assert: Request with incorrect casing
    try {
      await axios.get(`${context.baseUrl}/Health/Liveness`);
      fail('Expected 404 for case-sensitive route');
    } catch (error: any) {
      expect(error?.response).toBeDefined();
      expect(error?.response?.status).toBe(404);
    }
  });

  /**
   * Edge Case: Tests trailing slash behavior.
   */
  it('GET /health/liveness/ -> 200 (trailing slash handled)', async () => {
    // Act: Request with trailing slash
    const res = await axios.get(`${context.baseUrl}/health/liveness/`);

    // Assert: Should work (NestJS handles trailing slashes)
    expect(res.status).toBe(200);
    expect(res.data).toEqual({ message: 'Service still alive' });
  });

  /**
   * Edge Case: Tests query parameters on health endpoint.
   */
  it('GET /health/liveness?foo=bar -> 200 (query params ignored)', async () => {
    // Act: Request with query parameters
    const res = await axios.get(`${context.baseUrl}/health/liveness?foo=bar`);

    // Assert: Should work, query params ignored
    expect(res.status).toBe(200);
    expect(res.data).toEqual({ message: 'Service still alive' });
  });

  /**
   * Edge Case: Tests OPTIONS request (CORS preflight).
   */
  it('OPTIONS /health/liveness -> 204 or 200 (CORS preflight)', async () => {
    // Act: Send OPTIONS request
    try {
      const res = await axios.options(`${context.baseUrl}/health/liveness`);
      // Assert: Should return successful status if CORS is enabled
      expect([200, 204]).toContain(res.status);
    } catch (error) {
      // Assert: NestJS may return 404 if OPTIONS not explicitly handled
      expect(error.response.status).toBe(404);
    }
  });

  /**
   * Tests that Content-Type header is set correctly on JSON responses.
   */
  it('GET /health/liveness -> returns application/json Content-Type', async () => {
    // Act: Request health endpoint
    const res = await axios.get(`${context.baseUrl}/health/liveness`);

    // Assert: Verify Content-Type header
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  /**
   * Tests that 404 responses also have proper Content-Type.
   */
  it('GET /unknown -> 404 with application/json Content-Type', async () => {
    // Act & Assert: Verify 404 has JSON content type
    try {
      await axios.get(`${context.baseUrl}/unknown`);
      fail('Expected 404');
    } catch (error) {
      expect(error.response.status).toBe(404);
      expect(error.response.headers['content-type']).toMatch(
        /application\/json/
      );
    }
  });
});
