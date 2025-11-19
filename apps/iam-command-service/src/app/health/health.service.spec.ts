import { HealthService } from './health.service';
import { ServiceHealthStatus } from '@ecoma-io/common';

describe('HealthService (Command)', () => {
  it('returns UP when db/outbox/eventstore healthy', async () => {
    const ds: any = { query: jest.fn().mockResolvedValueOnce([{}]) };
    const outbox: any = { countUnpublished: jest.fn().mockResolvedValue(0) };
    const esRepo: any = { loadStreamVersion: jest.fn().mockResolvedValue(0) };
    const svc = new HealthService(
      ds as any,
      esRepo as any,
      outbox as any,
      undefined
    );

    const res = await svc.check();

    expect(res.data.database).toBe(ServiceHealthStatus.UP);
    expect(res.data.outbox).toBe(ServiceHealthStatus.UP);
    expect(res.data.eventstore).toBe(ServiceHealthStatus.UP);
    expect(res.message).toContain('Service is ready');
  });

  it('marks database DOWN if query fails', async () => {
    const ds: any = { query: jest.fn().mockRejectedValue(new Error('fail')) };
    const svc = new HealthService(ds as any, {} as any, {} as any);

    const res = await svc.check();

    expect(res.data.database).toBe(ServiceHealthStatus.DOWN);
    expect(res.message).toContain('Readiness check failed');
  });
});
