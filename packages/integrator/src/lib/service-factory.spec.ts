import { ServiceFactory } from './service-factory';

describe('serviceFactory', () => {
  it('returns direct service when proxy disabled', async () => {
    const f = new ServiceFactory('h', false, undefined as any);
    const svc = await f.createService('s', '3000');
    expect(svc).toStrictEqual({ host: 'h', port: 3000 });
  });

  it('throws on invalid port', async () => {
    const f = new ServiceFactory('h', false, undefined as any);
    await expect(f.createService('s', 'not-a-port')).rejects.toThrow();
  });

  it('returns proxied service when proxy provided', async () => {
    const proxy = {
      createProxy: jest.fn().mockResolvedValue({
        port: 4000,
        instance: { addToxic: jest.fn() },
        setEnabled: jest.fn(),
      }),
    } as any;

    const f = new ServiceFactory('hosty', true, proxy);
    const svc = await f.createService('s', 5000);
    expect(svc).toHaveProperty('host', 'hosty');
    expect(svc).toHaveProperty('port', 4000);
    expect(typeof (svc as any).addToxic).toBe('function');
  });
});
