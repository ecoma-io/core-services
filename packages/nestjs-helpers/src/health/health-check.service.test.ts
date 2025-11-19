import { HealthCheckService } from './health-check.service';
import { SuccessResponse, HealthDetails } from '@ecoma-io/common';

// Concrete implementation for testing purposes
/**
 * Test implementation of HealthCheckService for unit testing.
 *
 * @remarks
 * Allows configuring success/failure behavior and custom responses for testing edge cases.
 */
class TestHealthCheckService extends HealthCheckService {
  private shouldThrow: boolean;
  private response: SuccessResponse<HealthDetails> | null;

  /**
   * Creates an instance of TestHealthCheckService.
   *
   * @param shouldThrow - Whether the check method should throw an error.
   * @param response - Custom response to return; if null, uses default success response.
   */
  constructor(
    shouldThrow = false,
    response: SuccessResponse<HealthDetails> | null = null
  ) {
    super();
    this.shouldThrow = shouldThrow;
    this.response = response;
  }

  /**
   * Executes a readiness health check, simulating success or failure based on configuration.
   *
   * @returns {Promise<SuccessResponse<HealthDetails>>} A promise resolving to the health details or throwing an error.
   */
  async check(): Promise<SuccessResponse<HealthDetails>> {
    if (this.shouldThrow) {
      throw new Error('Simulated health check failure');
    }
    return (
      this.response || {
        message: 'ok',
        data: { db: { healthy: true } } as unknown as HealthDetails,
      }
    );
  }
}

describe('HealthCheckService', () => {
  test('check should return success response on happy path (Arrange, Act, Assert)', async () => {
    // Arrange: Create a service instance with default success response
    const service = new TestHealthCheckService();

    // Act: Call the check method
    const result = await service.check();

    // Assert: Verify the response matches expected success
    expect(result).toEqual({
      message: 'ok',
      data: { db: { healthy: true } } as unknown as HealthDetails,
    });
  });

  test('check should throw error on failure (Arrange, Act, Assert)', async () => {
    // Arrange: Create a service instance configured to throw
    const service = new TestHealthCheckService(true);

    // Act & Assert: Call check and expect it to throw
    await expect(service.check()).rejects.toThrow(
      'Simulated health check failure'
    );
  });

  test('check should handle edge case with null details (Arrange, Act, Assert)', async () => {
    // Arrange: Create a service instance with null details
    const edgeResponse: SuccessResponse<HealthDetails> = {
      message: 'ok',
      data: null as unknown as HealthDetails,
    };
    const service = new TestHealthCheckService(false, edgeResponse);

    // Act: Call the check method
    const result = await service.check();

    // Assert: Verify the response has null details
    expect(result.data).toBeNull();
    expect(result.message).toBe('ok');
  });

  test('check should handle edge case with empty message (Arrange, Act, Assert)', async () => {
    // Arrange: Create a service instance with empty message
    const edgeResponse: SuccessResponse<HealthDetails> = {
      message: '',
      data: { db: { healthy: false } } as unknown as HealthDetails,
    };
    const service = new TestHealthCheckService(false, edgeResponse);

    // Act: Call the check method
    const result = await service.check();

    // Assert: Verify the response has empty message
    expect(result.message).toBe('');
    expect(result.data).toEqual({
      db: { healthy: false },
    } as unknown as HealthDetails);
  });
});
