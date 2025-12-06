import { createClickhouseService } from './clickhouse';

jest.mock('@clickhouse/client', () => {
  return {
    createClient: jest.fn().mockImplementation(() => ({
      exec: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    })),
  };
});

describe('createClickhouseService', () => {
  test('creates database and returns client and databaseName', async () => {
    const createService = jest
      .fn()
      .mockResolvedValue({ host: '127.0.0.1', port: 8123 });
    const waitToCloses: Array<() => Promise<void>> = [];

    const res = await createClickhouseService({
      id: 'ch',
      createService,
      env: { CLICK_HOUSE_USER: 'u', CLICK_HOUSE_PASSWORD: 'p' } as any,
      waitToCloses,
    } as any);

    expect(res).toHaveProperty('clickhouseClient');
    expect(res).toHaveProperty('databaseName', 'test_ch');
    expect(waitToCloses.length).toBeGreaterThan(0);
    // call teardown to ensure client.close invoked
    await (waitToCloses[0]() as Promise<void>);
  });

  test('throws when exec fails', async () => {
    const mod = require('@clickhouse/client');
    mod.createClient.mockImplementationOnce(() => ({
      exec: jest.fn().mockRejectedValue(new Error('exec-fail')),
      close: jest.fn().mockResolvedValue(undefined),
    }));

    const createService = jest
      .fn()
      .mockResolvedValue({ host: '127.0.0.1', port: 8123 });

    await expect(
      createClickhouseService({
        id: 'ch2',
        createService,
        env: { CLICK_HOUSE_USER: 'u', CLICK_HOUSE_PASSWORD: 'p' } as any,
      } as any)
    ).rejects.toThrow(/Failed to initialize ClickHouse database/);
  });

  test('uses process.env when env not provided', async () => {
    const mod = require('@clickhouse/client');
    mod.createClient.mockImplementationOnce(() => ({
      exec: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    }));

    const createService = jest
      .fn()
      .mockResolvedValue({ host: '127.0.0.1', port: 8123 });

    const origUser = process.env.CLICK_HOUSE_USER;
    const origPass = process.env.CLICK_HOUSE_PASSWORD;
    process.env.CLICK_HOUSE_USER = 'u';
    process.env.CLICK_HOUSE_PASSWORD = 'p';

    const waitToCloses: Array<() => Promise<void>> = [];
    const res = await createClickhouseService({
      id: 'ch3',
      createService,
      clickhousePort: 8124,
      waitToCloses,
    } as any);

    expect(res).toHaveProperty('clickhouseClient');
    if (waitToCloses.length) await (waitToCloses[0]() as Promise<void>);

    process.env.CLICK_HOUSE_USER = origUser;
    process.env.CLICK_HOUSE_PASSWORD = origPass;
  });

  test('teardown rejects when close rejects', async () => {
    const mod = require('@clickhouse/client');
    mod.createClient.mockImplementationOnce(() => ({
      exec: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockRejectedValue(new Error('close-fail')),
    }));

    const createService = jest
      .fn()
      .mockResolvedValue({ host: '127.0.0.1', port: 8123 });

    const waitToCloses: Array<() => Promise<void>> = [];
    const res = await createClickhouseService({
      id: 'ch-close',
      createService,
      env: { CLICK_HOUSE_USER: 'u', CLICK_HOUSE_PASSWORD: 'p' } as any,
      waitToCloses,
    } as any);

    expect(res).toHaveProperty('clickhouseClient');
    await expect(waitToCloses[0]()).rejects.toThrow(/close-fail/);
  });

  test('works when createService returns empty service (missing host/port)', async () => {
    const mod = require('@clickhouse/client');
    mod.createClient.mockImplementationOnce(() => ({
      exec: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    }));

    const createService = jest.fn().mockResolvedValue({});

    const origUser = process.env.CLICK_HOUSE_USER;
    const origPass = process.env.CLICK_HOUSE_PASSWORD;
    process.env.CLICK_HOUSE_USER = 'u';
    process.env.CLICK_HOUSE_PASSWORD = 'p';

    const waitToCloses: Array<() => Promise<void>> = [];
    const res = await createClickhouseService({
      id: 'ch-empty',
      createService,
      waitToCloses,
    } as any);

    expect(res).toHaveProperty('clickhouseClient');

    if (waitToCloses.length) await waitToCloses[0]();

    process.env.CLICK_HOUSE_USER = origUser;
    process.env.CLICK_HOUSE_PASSWORD = origPass;
  });

  test('teardown when client has no close function resolves', async () => {
    // client without close function
    const mod = require('@clickhouse/client');
    mod.createClient.mockImplementationOnce(() => ({
      exec: jest.fn().mockResolvedValue(undefined),
      // no close present
    }));

    const createService = jest
      .fn()
      .mockResolvedValue({ host: '127.0.0.1', port: 8123 });
    const waitToCloses: Array<() => Promise<void>> = [];

    const res = await createClickhouseService({
      id: 'ch-noclose',
      createService,
      env: { CLICK_HOUSE_USER: 'u', CLICK_HOUSE_PASSWORD: 'p' } as any,
      waitToCloses,
    } as any);

    expect(res).toHaveProperty('clickhouseClient');
    // should not throw when invoked
    if (waitToCloses.length)
      await expect(waitToCloses[0]()).resolves.toBeUndefined();
  });
});
