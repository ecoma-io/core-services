import { ServiceHealthStatus } from './health.details';

describe('ServiceHealthStatus and HealthDetails', () => {
  test('enum values are expected strings', () => {
    expect(ServiceHealthStatus.UP).toBe('up');
    expect(ServiceHealthStatus.DOWN).toBe('down');
    expect(ServiceHealthStatus.UNKNOWN).toBe('unknown');
  });

  test('HealthDetails shape can map service ids to statuses', () => {
    const details: Record<string, ServiceHealthStatus> = {
      database: ServiceHealthStatus.UP,
      cache: ServiceHealthStatus.DOWN,
      auth: ServiceHealthStatus.UNKNOWN,
    };

    expect(details.database).toBe('up');
    expect(details.cache).toBe('down');
    expect(details.auth).toBe('unknown');
    expect(Object.keys(details)).toHaveLength(3);
  });
});
