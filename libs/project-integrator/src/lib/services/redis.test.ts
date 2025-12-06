import { createRedisService } from './redis';

jest.mock('ioredis', () => {
  return {
    Redis: jest.fn().mockImplementation(() => ({
      select: jest.fn().mockResolvedValue('OK'),
      set: jest.fn().mockResolvedValue('OK'),
      quit: jest.fn().mockResolvedValue('OK'),
    })),
  };
});

describe('createRedisService', () => {
  test('initializes redis and selects DB', async () => {
    // Arrange
    const waitToCloses: Array<() => Promise<void>> = [];
    const createService = jest
      .fn()
      .mockResolvedValue({ host: '127.0.0.1', port: 6379 });

    // Act
    const res = await createRedisService({
      id: 'r1',
      createService,
      env: { REDIS_PASSWORD: 'p' } as any,
      waitToCloses,
    });

    // Assert
    expect(res).toHaveProperty('redis');
    expect(createService).toHaveBeenCalledWith('redis-r1', undefined);
    expect(waitToCloses.length).toBeGreaterThan(0);
    // call teardown to cover redis.quit()
    await (waitToCloses[0]() as Promise<void>);
  });

  test('throws when redis select fails', async () => {
    const Redis = require('ioredis').Redis;
    Redis.mockImplementationOnce(() => ({
      select: jest.fn().mockRejectedValue(new Error('fail')),
      set: jest.fn(),
      quit: jest.fn().mockResolvedValue(undefined),
    }));

    const createService = jest
      .fn()
      .mockResolvedValue({ host: '127.0.0.1', port: 6379 });

    await expect(
      createRedisService({
        id: 'r2',
        createService,
        env: { REDIS_PASSWORD: 'p' } as any,
      })
    ).rejects.toThrow(/Failed to initialize Redis/);
  });

  test('works when env not provided (uses process.env)', async () => {
    const mod = require('ioredis');
    mod.Redis.mockImplementationOnce(() => ({
      select: jest.fn().mockResolvedValue('OK'),
      set: jest.fn().mockResolvedValue('OK'),
      quit: jest.fn().mockResolvedValue('OK'),
    }));
    const createService = jest
      .fn()
      .mockResolvedValue({ host: '127.0.0.1', port: 6379 });

    const origPass = process.env.REDIS_PASSWORD;
    process.env.REDIS_PASSWORD = 'p';

    const waitToCloses: Array<() => Promise<void>> = [];
    const res = await createRedisService({
      id: 'r3',
      createService,
      redisPort: 6380,
      waitToCloses,
    } as any);
    expect(res).toHaveProperty('redis');

    // call teardown to cover redis.quit() using process.env path
    if (waitToCloses.length) await (waitToCloses[0]() as Promise<void>);

    process.env.REDIS_PASSWORD = origPass;
  });

  test('teardown rejects when redis.quit rejects', async () => {
    const Redis = require('ioredis').Redis;
    Redis.mockImplementationOnce(() => ({
      select: jest.fn().mockResolvedValue('OK'),
      set: jest.fn().mockResolvedValue('OK'),
      quit: jest.fn().mockRejectedValue(new Error('quit-fail')),
    }));

    const createService = jest
      .fn()
      .mockResolvedValue({ host: '127.0.0.1', port: 6379 });

    const waitToCloses: Array<() => Promise<void>> = [];
    const res = await createRedisService({
      id: 'r-quit-fail',
      createService,
      env: { REDIS_PASSWORD: 'p' } as any,
      waitToCloses,
    } as any);

    expect(res).toHaveProperty('redis');
    await expect(waitToCloses[0]()).rejects.toThrow(/quit-fail/);
  });

  test('works with empty id (reduce over empty array)', async () => {
    const mod = require('ioredis');
    mod.Redis.mockImplementationOnce(() => ({
      select: jest.fn().mockResolvedValue('OK'),
      set: jest.fn().mockResolvedValue('OK'),
      quit: jest.fn().mockResolvedValue('OK'),
    }));

    const createService = jest
      .fn()
      .mockResolvedValue({ host: '127.0.0.1', port: 6379 });

    const waitToCloses: Array<() => Promise<void>> = [];
    const res = await createRedisService({
      id: '',
      createService,
      env: { REDIS_PASSWORD: 'p' } as any,
      waitToCloses,
    } as any);

    expect(res).toHaveProperty('redis');
    if (waitToCloses.length) await waitToCloses[0]();
  });

  test('handles createService returning empty service (missing host/port)', async () => {
    const mod = require('ioredis');
    mod.Redis.mockImplementationOnce(() => ({
      select: jest.fn().mockResolvedValue('OK'),
      set: jest.fn().mockResolvedValue('OK'),
      quit: jest.fn().mockResolvedValue('OK'),
    }));

    const createService = jest.fn().mockResolvedValue({});

    const origPass = process.env.REDIS_PASSWORD;
    process.env.REDIS_PASSWORD = 'p';

    const waitToCloses: Array<() => Promise<void>> = [];
    const res = await createRedisService({
      id: 'r-empty-service',
      createService,
      waitToCloses,
    } as any);

    expect(res).toHaveProperty('redis');
    if (waitToCloses.length) await waitToCloses[0]();

    process.env.REDIS_PASSWORD = origPass;
  });

  test('throws when redis.set fails', async () => {
    const Redis = require('ioredis').Redis;
    Redis.mockImplementationOnce(() => ({
      select: jest.fn().mockResolvedValue('OK'),
      set: jest.fn().mockRejectedValue(new Error('set-fail')),
      quit: jest.fn().mockResolvedValue(undefined),
    }));

    const createService = jest
      .fn()
      .mockResolvedValue({ host: '127.0.0.1', port: 6379 });

    await expect(
      createRedisService({
        id: 'r-set-fail',
        createService,
        env: { REDIS_PASSWORD: 'p' } as any,
      } as any)
    ).rejects.toThrow(/Failed to initialize Redis/);
  });
});
