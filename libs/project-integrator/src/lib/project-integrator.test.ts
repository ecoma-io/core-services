/* eslint-disable @typescript-eslint/no-empty-function */
import { InternalAxiosRequestConfig } from 'axios';

// Mock external dependencies BEFORE importing the module under test
jest.resetModules();

const mockValidateEnvVars = jest.fn();
jest.doMock('./utils/required-env-vars', () => ({
  validateEnvVars: mockValidateEnvVars,
}));

const mockInitLogger = jest.fn();
const mockInitTracer = jest.fn();
jest.doMock('./utils/observability', () => ({
  initStandardizedLogger: mockInitLogger,
  initStandardizedTracer: mockInitTracer,
}));

const mockShutdownLogger = jest.fn(() => Promise.resolve());
const mockShutdownTracer = jest.fn(() => Promise.resolve());
class MockStandardizedLogger {
  constructor(_: any) {}
  static shutdown = mockShutdownLogger;
  debug!: any;
  info!: any;
  verbose!: any;
  error!: any;
  warn!: any;
}
// attach jest.spyOn() implementations on prototype to satisfy lint while keeping tests working
MockStandardizedLogger.prototype.debug = function () {};
jest.spyOn(MockStandardizedLogger.prototype, 'debug').mockImplementation();
MockStandardizedLogger.prototype.info = function () {};
jest.spyOn(MockStandardizedLogger.prototype, 'info').mockImplementation();
MockStandardizedLogger.prototype.verbose = function () {};
jest.spyOn(MockStandardizedLogger.prototype, 'verbose').mockImplementation();
MockStandardizedLogger.prototype.error = function () {};
jest.spyOn(MockStandardizedLogger.prototype, 'error').mockImplementation();
MockStandardizedLogger.prototype.warn = function () {};
jest.spyOn(MockStandardizedLogger.prototype, 'warn').mockImplementation();
class MockStandardizedTracer {
  static shutdown = mockShutdownTracer;
}
jest.doMock('@ecoma-io/node-observability', () => ({
  StandardizedLogger: MockStandardizedLogger,
  StandardizedTracer: MockStandardizedTracer,
}));

jest.doMock('./utils/axios-interceptor', () => ({
  createAxiosInterceptor: () => (_: any) => (c: InternalAxiosRequestConfig) =>
    c,
}));

const mockFormatLog = jest.fn(
  (stream: string, message: Record<string, unknown>) => ({
    level: 'info',
    message,
  })
);
jest.doMock('./utils/format-log', () => ({
  formatLogMessageImpl: mockFormatLog,
}));

jest.doMock('uuidv7', () => ({ uuidv7: () => 'fixed-test-id' }));

// Service creator mocks used by getters tests
const mockEnsureVhost = jest.fn(() => Promise.resolve());
const mockCreatePostgres = jest.fn(() =>
  Promise.resolve({ dataSource: 'ds', databaseName: 'pg_db' })
);
const mockCreateRedis = jest.fn(() =>
  Promise.resolve({ redis: { ping: () => 'PONG' } })
);
const mockCreateMinio = jest.fn(() =>
  Promise.resolve({ bucketName: 'test-bucket', s3Client: {} })
);
const mockCreateMongo = jest.fn(() =>
  Promise.resolve({ mongoClient: {}, db: {}, databaseName: 'mongo_db' })
);
const mockCreateElastic = jest.fn(() =>
  Promise.resolve({ elasticsearchClient: {}, indexName: 'idx' })
);
const mockCreateRabbit = jest.fn(() =>
  Promise.resolve({ connection: {}, channel: {}, vhost: '/' })
);
const mockCreateEventstore = jest.fn(() =>
  Promise.resolve({ eventStoreClient: {}, streamPrefix: 'sp' })
);
const mockCreateClickhouse = jest.fn(() =>
  Promise.resolve({ clickhouseClient: {}, databaseName: 'click_db' })
);

jest.doMock('./services/postgres', () => ({
  createPostgresService: mockCreatePostgres,
}));
jest.doMock('./services/redis', () => ({
  createRedisService: mockCreateRedis,
}));
jest.doMock('./services/minio', () => ({
  createMinioService: mockCreateMinio,
}));
jest.doMock('./services/mongo', () => ({
  createMongoService: mockCreateMongo,
}));
jest.doMock('./services/elasticsearch', () => ({
  createElasticsearchService: mockCreateElastic,
}));
jest.doMock('./services/rabbitmq', () => ({
  createRabbitMQService: mockCreateRabbit,
  ensureRabbitMqVhost: mockEnsureVhost,
}));
jest.doMock('./services/eventstore', () => ({
  createEventStoreService: mockCreateEventstore,
}));
jest.doMock('./services/clickhouse', () => ({
  createClickhouseService: mockCreateClickhouse,
}));

// Provide a minimal IntegrationEnvironment so constructing the class is safe
jest.doMock('@ecoma-io/integrator', () => ({
  IntegrationEnvironment: class {
    public internalHost: string;
    public id: string;
    public logger: any;
    constructor(opts: any) {
      this.internalHost = opts.internalHost;
      this.id = opts.id;
      this.logger = opts.logger;
    }
    async stop(): Promise<void> {
      // noop
    }
    createService(name: string, port?: string | number) {
      return Promise.resolve({ name, port });
    }
  },
}));

import { ProductIntegratorEnvironment } from './project-integrator';

class TestEnvironment extends ProductIntegratorEnvironment {
  // implement abstract method from IntegrationEnvironment
  protected async initAppContainers(): Promise<Array<any>> {
    return [];
  }
}

describe('productIntegratorEnvironment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // sensible defaults used by constructor
    process.env.HYPERDX_OLTP_GRPC_PORT = '9999';
    process.env.HYPERDX_API_KEY = 'secret-key';
  });

  afterEach(() => {
    jest.resetModules();
  });

  test('constructor calls validateEnvVars and sets otel values', () => {
    // Arrange & Act
    const env = new TestEnvironment({ projectName: 'p', projectVersion: 'v' });

    // Assert
    expect(mockValidateEnvVars).toHaveBeenCalled();
    expect(env.projectName).toBe('p');
    expect(env.projectVersion).toBe('v');
    expect(env.otelEndpoint).toBe(`grpc://${(env as any).internalHost}:9999`);
    expect(env.otelHeaders).toBe('Authorization:secret-key');
    expect(typeof env.axiosInterceptor).toBe('function');
  });

  test('formatLogMessage delegates to formatLogMessageImpl', () => {
    // Arrange
    const env = new TestEnvironment({ projectName: 'p', projectVersion: 'v' });
    const payload = { foo: 'bar' } as Record<string, unknown>;

    // Act
    const result = env.formatLogMessage('stdout', payload);

    // Assert
    expect(mockFormatLog).toHaveBeenCalledWith('stdout', payload);
    expect(result).toStrictEqual({ level: 'info', message: payload });
  });

  test('stop calls static shutdowns and clears internal caches', async () => {
    // Arrange
    const env = new TestEnvironment({ projectName: 'p', projectVersion: 'v' });

    // Simulate cached services (private property access via bracket)
    (env as any).serviceCache = new Map();
    (env as any).serviceCache.set('k', Promise.resolve(1));

    // Act
    await env.stop();

    // Assert
    expect(mockShutdownLogger).toHaveBeenCalled();
    expect(mockShutdownTracer).toHaveBeenCalled();
    expect((env as any).serviceCache.size).toBe(0);
  });
});

describe('projectIntegrator getters and caching', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.HYPERDX_OLTP_GRPC_PORT = '1111';
    process.env.HYPERDX_API_KEY = 'k';
  });

  test('getPostgres caches result', async () => {
    const env = new TestEnvironment({ projectName: 'p', projectVersion: 'v' });
    const a = await env.getPostgres();
    const b = await env.getPostgres();
    expect(mockCreatePostgres).toHaveBeenCalledTimes(1);
    expect(a).toStrictEqual(b);
    expect(a).toHaveProperty('dataSource', 'ds');
  });

  test('getRedis caches result', async () => {
    const env = new TestEnvironment({ projectName: 'p', projectVersion: 'v' });
    const r1 = await env.getRedis();
    const r2 = await env.getRedis();
    expect(mockCreateRedis).toHaveBeenCalledTimes(1);
    expect(r1).toStrictEqual(r2);
    expect(r1).toHaveProperty('redis');
  });

  test('getMinio caches result', async () => {
    const env = new TestEnvironment({ projectName: 'p', projectVersion: 'v' });
    const m1 = await env.getMinio();
    const m2 = await env.getMinio();
    expect(mockCreateMinio).toHaveBeenCalledTimes(1);
    expect(m1).toStrictEqual(m2);
    expect(m1).toHaveProperty('bucketName', 'test-bucket');
  });

  test('getMaildev uses createService', async () => {
    const env = new TestEnvironment({ projectName: 'p', projectVersion: 'v' });
    const md = await env.getMaildev();
    expect(md).toHaveProperty('name');
    expect((md as any).name).toMatch(/maildev-/);
  });

  test('getMaildev caches result', async () => {
    const env = new TestEnvironment({ projectName: 'p', projectVersion: 'v' });
    const a = await env.getMaildev();
    const b = await env.getMaildev();
    expect(a).toStrictEqual(b);
  });

  test('getMongo caches result', async () => {
    const env = new TestEnvironment({ projectName: 'p', projectVersion: 'v' });
    const m1 = await env.getMongo();
    const m2 = await env.getMongo();
    expect(mockCreateMongo).toHaveBeenCalledTimes(1);
    expect(m1).toStrictEqual(m2);
    expect(m1).toHaveProperty('databaseName', 'mongo_db');
  });

  test('getElasticsearch caches result', async () => {
    const env = new TestEnvironment({ projectName: 'p', projectVersion: 'v' });
    const e1 = await env.getElasticsearch();
    const e2 = await env.getElasticsearch();
    expect(mockCreateElastic).toHaveBeenCalledTimes(1);
    expect(e1).toStrictEqual(e2);
    expect(e1).toHaveProperty('indexName', 'idx');
  });

  test('getRabbitMQ caches result', async () => {
    const env = new TestEnvironment({ projectName: 'p', projectVersion: 'v' });
    const r1 = await env.getRabbitMQ();
    const r2 = await env.getRabbitMQ();
    expect(mockCreateRabbit).toHaveBeenCalledTimes(1);
    expect(r1).toStrictEqual(r2);
    expect(r1).toHaveProperty('vhost');
  });

  test('getEventStoreDB caches result', async () => {
    const env = new TestEnvironment({ projectName: 'p', projectVersion: 'v' });
    const e1 = await env.getEventStoreDB();
    const e2 = await env.getEventStoreDB();
    expect(mockCreateEventstore).toHaveBeenCalledTimes(1);
    expect(e1).toStrictEqual(e2);
    expect(e1).toHaveProperty('streamPrefix', 'sp');
  });

  test('getClickhouse caches result', async () => {
    const env = new TestEnvironment({ projectName: 'p', projectVersion: 'v' });
    const c1 = await env.getClickhouse();
    const c2 = await env.getClickhouse();
    expect(mockCreateClickhouse).toHaveBeenCalledTimes(1);
    expect(c1).toStrictEqual(c2);
    expect(c1).toHaveProperty('databaseName', 'click_db');
  });
});

describe('projectIntegrator branch coverage', () => {
  test('constructor handles missing logger (optional chaining branch)', () => {
    // Recreate module with IntegrationEnvironment that sets logger undefined to exercise optional chaining
    jest.resetModules();
    jest.doMock('@ecoma-io/integrator', () => ({
      IntegrationEnvironment: class {
        public internalHost: string;
        public id: string;
        public logger: any = undefined; // no logger
        constructor(opts: any) {
          this.internalHost = opts.internalHost;
          this.id = opts.id;
        }
        async stop(): Promise<void> {}
      },
    }));

    const { ProductIntegratorEnvironment } = require('./project-integrator');
    class TestEnvLocal extends ProductIntegratorEnvironment {
      protected async initAppContainers(): Promise<Array<any>> {
        return [];
      }
    }

    process.env.HYPERDX_OLTP_GRPC_PORT = '2222';
    process.env.HYPERDX_API_KEY = 'x';

    const env = new (TestEnvLocal as any)({
      projectName: 'p',
      projectVersion: 'v',
    });
    expect(env.axiosInterceptor).toBeInstanceOf(Function);
  });

  test('stop continues when waitToCloses throws', async () => {
    jest.resetModules();
    jest.doMock('@ecoma-io/integrator', () => ({
      IntegrationEnvironment: class {
        public internalHost: string;
        public id: string;
        // provide a logger with callable methods to avoid runtime errors
        public logger: any = {
          debug: jest.fn(),
          info: jest.fn(),
          verbose: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
        };
        constructor(opts: any) {
          this.internalHost = opts.internalHost;
          this.id = opts.id;
        }
        async stop(): Promise<void> {}
      },
    }));

    const { ProductIntegratorEnvironment } = require('./project-integrator');
    class TestEnvLocal extends ProductIntegratorEnvironment {
      protected async initAppContainers(): Promise<Array<any>> {
        return [];
      }
    }

    process.env.HYPERDX_OLTP_GRPC_PORT = '3333';
    process.env.HYPERDX_API_KEY = 'y';

    const env = new (TestEnvLocal as any)({
      projectName: 'p',
      projectVersion: 'v',
    });

    // add successful cleanup
    (env as any).waitToCloses.push(async () => {
      (env as any).__cleanup1 = true;
    });
    // add failing cleanup
    (env as any).waitToCloses.push(async () => {
      throw new Error('boom');
    });

    await expect(env.stop()).resolves.toBeUndefined();
    expect(mockShutdownLogger).toHaveBeenCalled();
    expect(mockShutdownTracer).toHaveBeenCalled();
    expect((env as any).serviceCache.size).toBe(0);
  });

  test('stop handles missing logger when waitToCloses throws', async () => {
    // Recreate module with IntegrationEnvironment that sets logger undefined
    jest.resetModules();
    jest.doMock('@ecoma-io/integrator', () => ({
      IntegrationEnvironment: class {
        public internalHost: string;
        public id: string;
        public logger: any = undefined; // no logger
        constructor(opts: any) {
          this.internalHost = opts.internalHost;
          this.id = opts.id;
        }
        async stop(): Promise<void> {}
      },
    }));

    const { ProductIntegratorEnvironment } = require('./project-integrator');
    class TestEnvLocal extends ProductIntegratorEnvironment {
      protected async initAppContainers(): Promise<Array<any>> {
        return [];
      }
    }

    process.env.HYPERDX_OLTP_GRPC_PORT = '5555';
    process.env.HYPERDX_API_KEY = 'missing-logger-key';

    const env = new (TestEnvLocal as any)({
      projectName: 'p',
      projectVersion: 'v',
    });

    // add failing cleanup so the catch branch runs while logger is undefined
    (env as any).waitToCloses.push(async () => {
      throw new Error('boom-missing-logger');
    });

    await expect(env.stop()).resolves.toBeUndefined();
    expect(mockShutdownLogger).toHaveBeenCalled();
    expect(mockShutdownTracer).toHaveBeenCalled();
    expect((env as any).serviceCache.size).toBe(0);
  });
});

describe('additional ProductIntegratorEnvironment coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.HYPERDX_OLTP_GRPC_PORT = '4444';
    process.env.HYPERDX_API_KEY = 'z';
  });

  test('constructor initializes observability (logger & tracer)', () => {
    const env = new TestEnvironment({ projectName: 'p', projectVersion: 'v' });

    expect(mockInitLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'fixed-test-id',
        projectName: 'p',
        projectVersion: 'v',
      })
    );
    expect(mockInitTracer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'fixed-test-id',
        projectName: 'p',
        projectVersion: 'v',
      })
    );
    // axiosInterceptor factory should be present and callable
    expect(typeof env.axiosInterceptor).toBe('function');
  });

  test('axiosInterceptor returns configuration unchanged (identity interceptor)', () => {
    const env = new TestEnvironment({ projectName: 'p', projectVersion: 'v' });
    const cfg = {
      headers: { 'x-test': '1' },
    } as unknown as InternalAxiosRequestConfig;
    const interceptor = env.axiosInterceptor('svc');
    const out = interceptor(cfg);
    expect(out).toBe(cfg);
  });

  test('cachingService returns cached promise without invoking factory', async () => {
    const env = new TestEnvironment({ projectName: 'p', projectVersion: 'v' });
    const cached = Promise.resolve('cached-value');
    // pre-populate cache
    (env as any).serviceCache.set('cached', cached);

    const factory = jest.fn(() => Promise.resolve('new-value'));
    const res = await (env as any).cachingService('cached', factory);

    expect(res).toBe('cached-value');
    expect(factory).not.toHaveBeenCalled();
  });

  test('constructor logs initialization when logger present', () => {
    const env = new TestEnvironment({ projectName: 'p', projectVersion: 'v' });
    // logger is provided by the mocked IntegrationEnvironment via opts.logger
    expect((env as any).logger.debug).toHaveBeenCalledWith(
      `Initializing Integration Environment for project: ${env.projectName}`
    );
    // internalHost should be the hard-coded reference value
    expect((env as any).internalHost).toBe('172.168.186.168');
  });

  test('cachingService does not set cache when factory throws synchronously', () => {
    const env = new TestEnvironment({ projectName: 'p', projectVersion: 'v' });

    expect(() =>
      (env as any).cachingService('bad-sync', () => {
        throw new Error('sync-fail');
      })
    ).toThrow('sync-fail');

    expect((env as any).serviceCache.has('bad-sync')).toBe(false);
  });

  test('cachingService caches rejected promise and reuses it', async () => {
    const env = new TestEnvironment({ projectName: 'p', projectVersion: 'v' });

    const failingFactory = jest.fn(() =>
      Promise.reject(new Error('async-fail'))
    );

    const p1 = (env as any).cachingService('bad-async', failingFactory);
    await expect(p1).rejects.toThrow('async-fail');

    // cache should contain the rejected promise
    expect((env as any).serviceCache.has('bad-async')).toBe(true);

    // subsequent calls should return the same promise and not call factory again
    const p2 = (env as any).cachingService('bad-async', () =>
      Promise.resolve('ok')
    );
    expect(p2).toBe(p1);
    expect(failingFactory).toHaveBeenCalledTimes(1);
  });
});
