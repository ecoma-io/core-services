import { createPostgresService } from './postgres';

jest.mock('pg', () => {
  return {
    Client: jest.fn().mockImplementation(() => ({
      connect: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue(undefined),
      end: jest.fn().mockResolvedValue(undefined),
    })),
  };
});

jest.mock('typeorm', () => {
  return {
    DataSource: jest.fn().mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn().mockResolvedValue(undefined),
    })),
  };
});

describe('createPostgresService', () => {
  test('creates a database and initializes DataSource (happy path)', async () => {
    // Arrange
    const waitToCloses: Array<() => Promise<void>> = [];
    const createService = jest
      .fn()
      .mockResolvedValue({ host: '127.0.0.1', port: 5432 });

    // Act
    const _res = await createPostgresService({
      id: 'abc',
      createService,
      env: {
        POSTGRES_USERNAME: 'u',
        POSTGRES_PASSWORD: 'p',
      } as any,
      waitToCloses,
    });

    // Assert
    expect(_res).toHaveProperty('dataSource');
    expect(_res).toHaveProperty('databaseName', 'test_abc');
    expect(createService).toHaveBeenCalledWith('postgres-abc', undefined);
    expect(waitToCloses.length).toBeGreaterThan(0);

    // Execute cleanup pushed to waitToCloses to cover destroy path
    await waitToCloses[0]();
    expect(_res.dataSource.destroy).toHaveBeenCalled();
  });

  test('throws when pg client fails to create db', async () => {
    // Arrange
    const Client = require('pg').Client;
    Client.mockImplementationOnce(() => ({
      connect: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockRejectedValue(new Error('boom')),
      end: jest.fn().mockResolvedValue(undefined),
    }));

    const createService = jest
      .fn()
      .mockResolvedValue({ host: '127.0.0.1', port: 5432 });

    // Act & Assert
    await expect(
      createPostgresService({
        id: 'err',
        createService,
        env: { POSTGRES_USERNAME: 'u', POSTGRES_PASSWORD: 'p' } as any,
      })
    ).rejects.toThrow(/Failed to initialize Postgres database/);
  });

  test('throws when pg client.connect fails', async () => {
    // Arrange: simulate client.connect rejecting
    const Client = require('pg').Client;
    Client.mockImplementationOnce(() => ({
      connect: jest.fn().mockRejectedValue(new Error('connect-fail')),
      query: jest.fn().mockResolvedValue(undefined),
      end: jest.fn().mockResolvedValue(undefined),
    }));

    const createService = jest
      .fn()
      .mockResolvedValue({ host: '127.0.0.1', port: 5432 });

    await expect(
      createPostgresService({
        id: 'connect-err',
        createService,
        env: { POSTGRES_USERNAME: 'u', POSTGRES_PASSWORD: 'p' } as any,
      })
    ).rejects.toThrow(/Failed to initialize Postgres database/);
  });

  test('throws when DataSource initialize fails', async () => {
    // Arrange
    const DataSource = require('typeorm').DataSource;
    DataSource.mockImplementationOnce(() => ({
      initialize: jest.fn().mockRejectedValue(new Error('init-fail')),
      destroy: jest.fn().mockResolvedValue(undefined),
    }));

    const createService = jest
      .fn()
      .mockResolvedValue({ host: '127.0.0.1', port: 5432 });

    // Act & Assert
    await expect(
      createPostgresService({
        id: 'dx',
        createService,
        env: { POSTGRES_USERNAME: 'u', POSTGRES_PASSWORD: 'p' } as any,
      })
    ).rejects.toThrow(/Failed to connect to test database/);
  });

  test('ignores errors from client.end', async () => {
    // Arrange: make client.end throw
    const Client = require('pg').Client;
    Client.mockImplementationOnce(() => ({
      connect: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue(undefined),
      end: jest.fn().mockRejectedValue(new Error('end-fail')),
    }));

    const createService = jest
      .fn()
      .mockResolvedValue({ host: '127.0.0.1', port: 5432 });

    // Act: should resolve despite client.end rejecting
    const _res = await createPostgresService({
      id: 'e1',
      createService,
      env: { POSTGRES_USERNAME: 'u', POSTGRES_PASSWORD: 'p' } as any,
    });

    // Assert
    expect(_res).toHaveProperty('dataSource');
  });

  test('works when env not provided (uses process.env)', async () => {
    const Client = require('pg').Client;
    Client.mockImplementationOnce(() => ({
      connect: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue(undefined),
      end: jest.fn().mockResolvedValue(undefined),
    }));

    const DataSource = require('typeorm').DataSource;
    DataSource.mockImplementationOnce(() => ({
      initialize: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn().mockResolvedValue(undefined),
    }));

    const createService = jest
      .fn()
      .mockResolvedValue({ host: '127.0.0.1', port: 5432 });

    const origUser = process.env.POSTGRES_USERNAME;
    const origPass = process.env.POSTGRES_PASSWORD;
    process.env.POSTGRES_USERNAME = 'u';
    process.env.POSTGRES_PASSWORD = 'p';

    const waitToCloses: Array<() => Promise<void>> = [];
    const _res = await createPostgresService({
      id: 'env1',
      createService,
      waitToCloses,
    } as any);
    expect(_res).toHaveProperty('dataSource');

    // cleanup
    await waitToCloses[0]();

    process.env.POSTGRES_USERNAME = origUser;
    process.env.POSTGRES_PASSWORD = origPass;
  });

  test('respects explicit postgresPort when provided', async () => {
    const waitToCloses: Array<() => Promise<void>> = [];
    const createService = jest
      .fn()
      .mockResolvedValue({ host: '127.0.0.1', port: 5433 });

    const _res = await createPostgresService({
      id: 'p-port',
      createService,
      postgresPort: 5433,
      env: {
        POSTGRES_USERNAME: 'u',
        POSTGRES_PASSWORD: 'p',
      } as any,
      waitToCloses,
    });

    expect(createService).toHaveBeenCalledWith('postgres-p-port', 5433);
    await waitToCloses[0]();
  });

  test('handles service with missing port (coerces to 0)', async () => {
    const waitToCloses: Array<() => Promise<void>> = [];
    const createService = jest.fn().mockResolvedValue({ host: '127.0.0.1' });

    const _res = await createPostgresService({
      id: 'noport',
      createService,
      env: {
        POSTGRES_USERNAME: 'u',
        POSTGRES_PASSWORD: 'p',
      } as any,
      waitToCloses,
    } as any);

    expect(_res).toHaveProperty('dataSource');
    // cleanup
    await waitToCloses[0]();
  });

  test('accepts port as string and coerces to number', async () => {
    const waitToCloses: Array<() => Promise<void>> = [];
    const createService = jest
      .fn()
      .mockResolvedValue({ host: '127.0.0.1', port: '5432' });

    const _res = await createPostgresService({
      id: 'strport',
      createService,
      env: {
        POSTGRES_USERNAME: 'u',
        POSTGRES_PASSWORD: 'p',
      } as any,
      waitToCloses,
    } as any);

    expect(_res).toHaveProperty('dataSource');
    await waitToCloses[0]();
  });

  test('handles service port explicitly null', async () => {
    const waitToCloses: Array<() => Promise<void>> = [];
    const createService = jest
      .fn()
      .mockResolvedValue({ host: '127.0.0.1', port: null });

    const _res = await createPostgresService({
      id: 'nullport',
      createService,
      env: {
        POSTGRES_USERNAME: 'u',
        POSTGRES_PASSWORD: 'p',
      } as any,
      waitToCloses,
    } as any);

    expect(_res).toHaveProperty('dataSource');
    await waitToCloses[0]();
  });

  test('accepts numeric zero port', async () => {
    const waitToCloses: Array<() => Promise<void>> = [];
    const createService = jest
      .fn()
      .mockResolvedValue({ host: '127.0.0.1', port: 0 });

    const _res = await createPostgresService({
      id: 'zerport',
      createService,
      env: {
        POSTGRES_USERNAME: 'u',
        POSTGRES_PASSWORD: 'p',
      } as any,
      waitToCloses,
    } as any);

    expect(_res).toHaveProperty('dataSource');
    await waitToCloses[0]();
  });

  test('teardown rejects when DataSource.destroy rejects', async () => {
    const DataSource = require('typeorm').DataSource;
    DataSource.mockImplementationOnce(() => ({
      initialize: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn().mockRejectedValue(new Error('destroy-fail')),
    }));

    const Client = require('pg').Client;
    Client.mockImplementationOnce(() => ({
      connect: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue(undefined),
      end: jest.fn().mockResolvedValue(undefined),
    }));

    const createService = jest
      .fn()
      .mockResolvedValue({ host: '127.0.0.1', port: 5432 });

    const waitToCloses: Array<() => Promise<void>> = [];
    const res = await createPostgresService({
      id: 'p-destroy-fail',
      createService,
      env: {
        POSTGRES_USERNAME: 'u',
        POSTGRES_PASSWORD: 'p',
      } as any,
      waitToCloses,
    });

    expect(res).toHaveProperty('dataSource');
    await expect(waitToCloses[0]()).rejects.toThrow(/destroy-fail/);
  });

  test('handles service with port property present but undefined', async () => {
    const waitToCloses: Array<() => Promise<void>> = [];
    const svc: Record<string, unknown> = { host: '127.0.0.1' };
    Object.defineProperty(svc, 'port', {
      value: undefined,
      enumerable: true,
      configurable: true,
    });

    const createService = jest.fn().mockResolvedValue(svc);

    const res = await createPostgresService({
      id: 'undefprop',
      createService,
      env: {
        POSTGRES_USERNAME: 'u',
        POSTGRES_PASSWORD: 'p',
      } as any,
      waitToCloses,
    } as any);

    expect(res).toHaveProperty('dataSource');
    await waitToCloses[0]();
  });
});
test('handles service with missing host property (defaults to empty host)', async () => {
  // Arrange
  const waitToCloses: Array<() => Promise<void>> = [];
  const createService = jest.fn().mockResolvedValue({ port: 5432 });

  // Act
  const _res = await createPostgresService({
    id: 'nohost',
    createService,
    env: {
      POSTGRES_USERNAME: 'u',
      POSTGRES_PASSWORD: 'p',
    } as any,
    waitToCloses,
  } as any);

  // Assert
  expect(_res).toHaveProperty('dataSource');
  // cleanup
  await waitToCloses[0]();
});
