import { createElasticsearchService } from './elasticsearch';

jest.mock('@elastic/elasticsearch', () => {
  return {
    Client: jest.fn().mockImplementation(() => ({
      ping: jest.fn().mockResolvedValue(undefined),
      indices: { create: jest.fn().mockResolvedValue(undefined) },
      close: jest.fn().mockResolvedValue(undefined),
    })),
  };
});

describe('createElasticsearchService', () => {
  test('pings and creates index when possible', async () => {
    // Arrange
    const createService = jest
      .fn()
      .mockResolvedValue({ host: '127.0.0.1', port: 9200 });
    const waitToCloses: Array<() => Promise<void>> = [];

    // Act
    const res = await createElasticsearchService({
      id: 'es1',
      createService,
      env: { ELASTIC_PASSWORD: 'p' } as any,
      waitToCloses,
    });

    // Assert
    expect(res).toHaveProperty('elasticsearchClient');
    expect(res).toHaveProperty('indexName', 'test_es1');
    expect(waitToCloses.length).toBeGreaterThan(0);
    // call teardown to cover close()
    await (waitToCloses[0]() as Promise<void>);
  });

  test('throws when ping fails', async () => {
    // Arrange
    const Client = require('@elastic/elasticsearch').Client;
    Client.mockImplementationOnce(() => ({
      ping: jest.fn().mockRejectedValue(new Error('down')),
    }));
    const createService = jest
      .fn()
      .mockResolvedValue({ host: '127.0.0.1', port: 9200 });

    // Act & Assert
    await expect(
      createElasticsearchService({
        id: 'es2',
        createService,
        env: { ELASTIC_PASSWORD: 'p' } as any,
      })
    ).rejects.toThrow(/Failed to connect to Elasticsearch/);
  });

  test('works when indices API is undefined', async () => {
    // Arrange
    const Client = require('@elastic/elasticsearch').Client;
    Client.mockImplementationOnce(() => ({
      ping: jest.fn().mockResolvedValue(undefined),
      indices: undefined,
      close: jest.fn().mockResolvedValue(undefined),
    }));
    const createService = jest
      .fn()
      .mockResolvedValue({ host: '127.0.0.1', port: 9200 });

    // Act
    const waitToCloses: Array<() => Promise<void>> = [];
    const res = await createElasticsearchService({
      id: 'es3',
      createService,
      env: { ELASTIC_PASSWORD: 'p' } as any,
      waitToCloses,
    });

    // Assert
    expect(res).toHaveProperty('elasticsearchClient');
    // ensure we can call teardown when indices api is undefined
    if (waitToCloses.length) await (waitToCloses[0]() as Promise<void>);
  });

  test('ignores indices.create errors and still returns', async () => {
    // Arrange
    const Client = require('@elastic/elasticsearch').Client;
    Client.mockImplementationOnce(() => ({
      ping: jest.fn().mockResolvedValue(undefined),
      indices: {
        create: jest.fn().mockRejectedValue(new Error('create-fail')),
      },
      close: jest.fn().mockResolvedValue(undefined),
    }));

    const createService = jest
      .fn()
      .mockResolvedValue({ host: '127.0.0.1', port: 9200 });

    // Act
    const waitToCloses: Array<() => Promise<void>> = [];

    const res = await createElasticsearchService({
      id: 'es5',
      createService,
      env: { ELASTIC_PASSWORD: 'p' } as any,
      waitToCloses,
    });

    // Assert
    expect(res).toHaveProperty('elasticsearchClient');
    // call teardown to ensure close path covered
    await (waitToCloses[0]() as Promise<void>);
  });

  test('uses default env when env not provided', async () => {
    // Arrange: ensure the function can pick values from process.env
    const Client = require('@elastic/elasticsearch').Client;
    Client.mockImplementationOnce(() => ({
      ping: jest.fn().mockResolvedValue(undefined),
      indices: { create: jest.fn().mockResolvedValue(undefined) },
      close: jest.fn().mockResolvedValue(undefined),
    }));
    const createService = jest
      .fn()
      .mockResolvedValue({ host: '127.0.0.1', port: 9200 });

    // Delete any process.env ELASTIC_PASSWORD to ensure default path
    const original = process.env.ELASTIC_PASSWORD;
    delete process.env.ELASTIC_PASSWORD;

    // Act
    const res = await createElasticsearchService({
      id: 'es4',
      createService,
    } as any);

    // Assert
    expect(res).toHaveProperty('elasticsearchClient');

    // restore
    process.env.ELASTIC_PASSWORD = original;
  });

  test('respects explicit elasticPort when provided', async () => {
    // Arrange
    const Client = require('@elastic/elasticsearch').Client;
    Client.mockImplementationOnce(() => ({
      ping: jest.fn().mockResolvedValue(undefined),
      indices: { create: jest.fn().mockResolvedValue(undefined) },
      close: jest.fn().mockResolvedValue(undefined),
    }));

    const createService = jest
      .fn()
      .mockResolvedValue({ host: '127.0.0.1', port: 9999 });
    const waitToCloses: Array<() => Promise<void>> = [];

    // Act
    const res = await createElasticsearchService({
      id: 'es-port',
      createService,
      elasticPort: 9300,
      env: { ELASTIC_PASSWORD: 'p' } as any,
      waitToCloses,
    } as any);

    // Assert
    expect(res).toHaveProperty('elasticsearchClient');
    expect(createService).toHaveBeenCalledWith('elasticsearch-es-port', 9300);
    await (waitToCloses[0]() as Promise<void>);
  });

  test('skips index creation when indices.create is not a function', async () => {
    // Arrange
    const Client = require('@elastic/elasticsearch').Client;
    Client.mockImplementationOnce(() => ({
      ping: jest.fn().mockResolvedValue(undefined),
      indices: { create: 123 },
      close: jest.fn().mockResolvedValue(undefined),
    }));

    const createService = jest
      .fn()
      .mockResolvedValue({ host: '127.0.0.1', port: 9200 });

    // Act
    const res = await createElasticsearchService({
      id: 'es-no-create-fn',
      createService,
      env: { ELASTIC_PASSWORD: 'p' } as any,
    } as any);

    // Assert
    expect(res).toHaveProperty('elasticsearchClient');
  });

  test('handles indices.create being explicitly undefined', async () => {
    // Arrange
    const Client = require('@elastic/elasticsearch').Client;
    Client.mockImplementationOnce(() => ({
      ping: jest.fn().mockResolvedValue(undefined),
      indices: { create: undefined },
      close: jest.fn().mockResolvedValue(undefined),
    }));

    const createService = jest
      .fn()
      .mockResolvedValue({ host: '127.0.0.1', port: 9200 });

    // Act
    const res = await createElasticsearchService({
      id: 'es-undef-create',
      createService,
      env: { ELASTIC_PASSWORD: 'p' } as any,
    } as any);

    // Assert
    expect(res).toHaveProperty('elasticsearchClient');
  });

  test('works when createService returns empty service (missing host/port)', async () => {
    // Arrange
    const Client = require('@elastic/elasticsearch').Client;
    Client.mockImplementationOnce(() => ({
      ping: jest.fn().mockResolvedValue(undefined),
      indices: { create: jest.fn().mockResolvedValue(undefined) },
      close: jest.fn().mockResolvedValue(undefined),
    }));

    const createService = jest.fn().mockResolvedValue({});

    // Act
    const res = await createElasticsearchService({
      id: 'es-empty',
      createService,
      env: { ELASTIC_PASSWORD: 'p' } as any,
    } as any);

    // Assert
    expect(res).toHaveProperty('elasticsearchClient');
  });
});
