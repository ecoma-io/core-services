import { HealthService } from './health.service';
import { ServiceHealthStatus } from '@ecoma-io/common';

describe('HealthService (Projector)', () => {
  it('returns UP when db and rabbit adapter exist', async () => {
    const ds: any = { query: jest.fn().mockResolvedValueOnce([{}]) };
    const rabbitAdapter: any = {
      /* presence is enough for current check */
    };
    const svc = new HealthService(ds as any, rabbitAdapter as any, undefined);

    const res = await svc.check();

    expect(res.data.database).toBe(ServiceHealthStatus.UP);
    expect(res.data.rabbitmq).toBe(ServiceHealthStatus.UP);
    expect(res.message).toContain('Service is ready');
  });

  it('marks rabbitmq DOWN when adapter is missing', async () => {
    const ds: any = { query: jest.fn().mockResolvedValueOnce([{}]) };
    const svc = new HealthService(ds as any, undefined, undefined);

    const res = await svc.check();

    expect(res.data.database).toBe(ServiceHealthStatus.UP);
    expect(res.data.rabbitmq).toBe(ServiceHealthStatus.DOWN);
  });
});
