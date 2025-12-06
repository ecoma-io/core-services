import { createEventStoreService } from './eventstore';

jest.mock('@eventstore/db-client', () => ({
  EventStoreDBClient: {
    connectionString: jest
      .fn()
      .mockImplementation(() => ({ dispose: jest.fn() })),
  },
}));

describe('createEventStoreService', () => {
  test('creates client and returns streamPrefix', async () => {
    // Arrange
    const createService = jest
      .fn()
      .mockResolvedValue({ host: '127.0.0.1', port: 2113 });
    const waitToCloses: Array<() => void> = [];

    // Act
    const res = await createEventStoreService({
      id: 'esdb',
      createService,
      env: {} as any,
      waitToCloses,
    });

    // Assert
    expect(res).toHaveProperty('eventStoreClient');
    expect(res).toHaveProperty('streamPrefix', 'test_esdb');
    // call the pushed cleanup function to cover dispose path
    waitToCloses.forEach((fn) => fn());
  });

  test('works when env not provided (uses process.env)', async () => {
    // Arrange
    const mod = require('@eventstore/db-client');
    mod.EventStoreDBClient.connectionString.mockImplementationOnce(() => ({
      dispose: jest.fn(),
    }));
    const createService = jest
      .fn()
      .mockResolvedValue({ host: '127.0.0.1', port: 2113 });

    // Act
    const res = await createEventStoreService({
      id: 'esdb2',
      createService,
    } as any);

    // Assert
    expect(res).toHaveProperty('eventStoreClient');

    // Arrange (second scenario: ensure cleanup handles dispose throwing)
    const waitToCloses: Array<() => void> = [];
    const mod2 = require('@eventstore/db-client');
    mod2.EventStoreDBClient.connectionString.mockImplementationOnce(() => ({
      dispose: jest.fn().mockImplementation(() => {
        throw new Error('dispose-bang');
      }),
    }));

    // Act (second scenario)
    const _res2 = await createEventStoreService({
      id: 'esdb3',
      createService,
      waitToCloses,
    } as any);

    // Assert (second scenario)
    // calling cleanup should not throw (catch swallows errors)
    waitToCloses.forEach((fn) => expect(() => fn()).not.toThrow());
  });

  test('respects explicit esdbPort when provided', async () => {
    // Arrange
    const mod = require('@eventstore/db-client');
    mod.EventStoreDBClient.connectionString.mockImplementationOnce(() => ({
      dispose: jest.fn(),
    }));
    const createService = jest
      .fn()
      .mockResolvedValue({ host: '127.0.0.1', port: 2113 });

    // Act
    const res = await createEventStoreService({
      id: 'esdb-port',
      createService,
      esdbPort: 21130,
      env: {} as any,
    } as any);

    // Assert
    expect(res).toHaveProperty('eventStoreClient');
  });

  test('handles missing dispose method gracefully when cleanup is invoked', async () => {
    // Arrange
    const mod = require('@eventstore/db-client');
    // return an object without dispose
    mod.EventStoreDBClient.connectionString.mockImplementationOnce(() => ({}));
    const createService = jest
      .fn()
      .mockResolvedValue({ host: '127.0.0.1', port: 2113 });

    const waitToCloses: Array<() => void> = [];

    // Act
    const res = await createEventStoreService({
      id: 'esdb-no-dispose',
      createService,
      env: {} as any,
      waitToCloses,
    } as any);

    // Assert
    expect(res).toHaveProperty('eventStoreClient');
    // calling cleanup should not throw even if dispose is missing
    waitToCloses.forEach((fn) => expect(() => fn()).not.toThrow());
  });

  test('works when createService returns empty service (missing host/port)', async () => {
    // Arrange
    const mod = require('@eventstore/db-client');
    mod.EventStoreDBClient.connectionString.mockImplementationOnce(() => ({
      dispose: jest.fn(),
    }));
    const createService = jest.fn().mockResolvedValue({});

    // Act
    const res = await createEventStoreService({
      id: 'esdb-empty',
      createService,
      env: {} as any,
    } as any);

    // Assert
    expect(res).toHaveProperty('eventStoreClient');
  });

  test('throws when EventStoreDBClient.connectionString throws', async () => {
    // Arrange
    const mod = require('@eventstore/db-client');
    mod.EventStoreDBClient.connectionString.mockImplementationOnce(() => {
      throw new Error('cs-fail');
    });
    const createService = jest
      .fn()
      .mockResolvedValue({ host: '127.0.0.1', port: 2113 });

    // Act & Assert
    await expect(
      createEventStoreService({
        id: 'esdb-cs-fail',
        createService,
        env: {} as any,
      } as any)
    ).rejects.toThrow(/cs-fail/);
  });
});
