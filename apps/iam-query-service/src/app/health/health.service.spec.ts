import { HealthService } from './health.service';
import { ServiceHealthStatus } from '@ecoma-io/common';

describe('HealthService (Query)', () => {
  it('returns UP when db and cache are healthy', async () => {
    const ds: any = { query: jest.fn().mockResolvedValueOnce([{}]) };
    const permissionCache: any = {
      getCombinedPermissionsTree: jest.fn().mockResolvedValue({}),
    };
    const svc = new HealthService(ds as any, permissionCache as any);

    const res = await svc.check();

    expect(res.data.database).toBe(ServiceHealthStatus.UP);
    expect(res.data.redis).toBe(ServiceHealthStatus.UP);
    expect(res.message).toContain('Service is ready');
  });

  it('returns DOWN when db query fails', async () => {
    const ds: any = { query: jest.fn().mockRejectedValue(new Error('fail')) };
    const svc = new HealthService(ds as any);

    const res = await svc.check();

    expect(res.data.database).toBe(ServiceHealthStatus.DOWN);
    expect(res.message).toContain('Readiness check failed');
  });
});
