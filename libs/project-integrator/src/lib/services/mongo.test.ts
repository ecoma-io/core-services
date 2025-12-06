import { createMongoService } from './mongo';

jest.mock('mongodb', () => {
  return {
    MongoClient: jest.fn().mockImplementation(() => ({
      connect: jest.fn().mockResolvedValue(undefined),
      db: jest.fn().mockReturnValue({}),
      close: jest.fn().mockResolvedValue(undefined),
    })),
  };
});

describe('createMongoService', () => {
  test('connects and returns db and client', async () => {
    // Arrange
    const createService = jest
      .fn()
      .mockResolvedValue({ host: '127.0.0.1', port: 27017 });
    const waitToCloses: Array<() => Promise<void>> = [];

    // Act
    const res = await createMongoService({
      id: 'mm',
      createService,
      env: { MONGO_USERNAME: 'u', MONGO_PASSWORD: 'p' } as any,
      waitToCloses,
    });

    // Assert
    expect(res).toHaveProperty('mongoClient');
    expect(res).toHaveProperty('db');
    expect(res).toHaveProperty('databaseName', 'test_mm');
    expect(waitToCloses.length).toBeGreaterThan(0);
    // call teardown to ensure mongoClient.close() invoked
    await (waitToCloses[0]() as Promise<void>);
  });

  test('throws when connect fails', async () => {
    // Arrange
    const MongoClient = require('mongodb').MongoClient;
    MongoClient.mockImplementationOnce(() => ({
      connect: jest.fn().mockRejectedValue(new Error('x')),
    }));

    const createService = jest
      .fn()
      .mockResolvedValue({ host: '127.0.0.1', port: 27017 });

    // Act & Assert
    await expect(
      createMongoService({
        id: 'mm2',
        createService,
        env: { MONGO_USERNAME: 'u', MONGO_PASSWORD: 'p' } as any,
      })
    ).rejects.toThrow(/Failed to connect to MongoDB/);
  });

  test('works when env not provided (uses process.env)', async () => {
    // Arrange
    const mod = require('mongodb');
    mod.MongoClient.mockImplementationOnce(() => ({
      connect: jest.fn().mockResolvedValue(undefined),
      db: jest.fn().mockReturnValue({}),
      close: jest.fn().mockResolvedValue(undefined),
    }));
    const createService = jest
      .fn()
      .mockResolvedValue({ host: '127.0.0.1', port: 27017 });

    // set process env credentials
    const origUser = process.env.MONGO_USERNAME;
    const origPass = process.env.MONGO_PASSWORD;
    process.env.MONGO_USERNAME = 'u';
    process.env.MONGO_PASSWORD = 'p';

    // Act
    const waitToCloses: Array<() => Promise<void>> = [];
    const res = await createMongoService({
      id: 'mm3',
      createService,
      mongoPort: 27018,
      waitToCloses,
    } as any);

    // Assert
    expect(res).toHaveProperty('mongoClient');
    // call teardown to ensure it closes
    if (waitToCloses.length) await (waitToCloses[0]() as Promise<void>);

    process.env.MONGO_USERNAME = origUser;
    process.env.MONGO_PASSWORD = origPass;
  });

  test('teardown rejects when mongoClient.close rejects', async () => {
    // Arrange
    const mod = require('mongodb');
    mod.MongoClient.mockImplementationOnce(() => ({
      connect: jest.fn().mockResolvedValue(undefined),
      db: jest.fn().mockReturnValue({}),
      close: jest.fn().mockRejectedValue(new Error('close-fail')),
    }));

    const createService = jest
      .fn()
      .mockResolvedValue({ host: '127.0.0.1', port: 27017 });

    // Act
    const waitToCloses: Array<() => Promise<void>> = [];
    const res = await createMongoService({
      id: 'mm-close-fail',
      createService,
      env: { MONGO_USERNAME: 'u', MONGO_PASSWORD: 'p' } as any,
      waitToCloses,
    } as any);

    // Assert
    expect(res).toHaveProperty('mongoClient');
    // calling teardown should reject because close failed
    await expect(waitToCloses[0]()).rejects.toThrow(/close-fail/);
  });

  test('handles mongoClient.db returning falsy value', async () => {
    // Arrange
    const mod = require('mongodb');
    mod.MongoClient.mockImplementationOnce(() => ({
      connect: jest.fn().mockResolvedValue(undefined),
      db: jest.fn().mockReturnValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    }));

    const createService = jest
      .fn()
      .mockResolvedValue({ host: '127.0.0.1', port: 27017 });

    // Act
    const waitToCloses: Array<() => Promise<void>> = [];
    const res = await createMongoService({
      id: 'mm-falsy-db',
      createService,
      env: { MONGO_USERNAME: 'u', MONGO_PASSWORD: 'p' } as any,
      waitToCloses,
    } as any);

    // Assert
    expect(res).toHaveProperty('mongoClient');
    expect(res).toHaveProperty('db', undefined);
    if (waitToCloses.length) await waitToCloses[0]();
  });

  test('works when createService returns empty service (missing host/port)', async () => {
    // Arrange
    const mod = require('mongodb');
    mod.MongoClient.mockImplementationOnce(() => ({
      connect: jest.fn().mockResolvedValue(undefined),
      db: jest.fn().mockReturnValue({}),
      close: jest.fn().mockResolvedValue(undefined),
    }));

    const createService = jest.fn().mockResolvedValue({});

    const origUser = process.env.MONGO_USERNAME;
    const origPass = process.env.MONGO_PASSWORD;
    process.env.MONGO_USERNAME = 'u';
    process.env.MONGO_PASSWORD = 'p';

    // Act
    const waitToCloses: Array<() => Promise<void>> = [];
    const res = await createMongoService({
      id: 'mm-empty',
      createService,
      waitToCloses,
    } as any);

    // Assert
    expect(res).toHaveProperty('mongoClient');

    if (waitToCloses.length) await waitToCloses[0]();

    process.env.MONGO_USERNAME = origUser;
    process.env.MONGO_PASSWORD = origPass;
  });
});
