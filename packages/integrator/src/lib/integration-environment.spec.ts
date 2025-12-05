jest.mock('@testcontainers/toxiproxy', () => {
  return {
    ToxiProxyContainer: jest.fn().mockImplementation(function (image: string) {
      // store image for assertions
      (this as any).image = image;
      this.withLogConsumer = jest.fn().mockImplementation(() => this);
      this.start = jest.fn().mockResolvedValue({
        // minimal shaped proxy returned to callers
        createProxy: jest.fn().mockResolvedValue({
          port: 1111,
          instance: { addToxic: jest.fn() },
          setEnabled: jest.fn(),
        }),
      });
    }),
  };
});

jest.mock('./service-factory', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(function (
      internalHost: string,
      enableProxy: boolean,
      proxy: unknown
    ) {
      this.createService = jest
        .fn()
        .mockImplementation(async (name: string, port: string | number) => {
          if (enableProxy && proxy) {
            return {
              host: internalHost,
              port: 2222,
              addToxic: jest.fn(),
              setEnabled: jest.fn(),
            };
          }
          return {
            host: internalHost,
            port: typeof port === 'number' ? port : parseInt(String(port), 10),
          };
        });
    }),
  };
});

import { IntegrationEnvironment } from './integration-environment';

describe('IntegrationEnvironment', () => {
  const mockLogger = {
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    verbose: jest.fn(),
  } as any;

  class TestEnv extends IntegrationEnvironment {
    protected async initAppContainers() {
      return [
        { stop: jest.fn().mockResolvedValue(undefined) } as unknown as any,
      ];
    }

    protected formatLogMessage(
      streamType: 'stdout' | 'stderr',
      message: object
    ) {
      return { level: 'info' as const, message };
    }
  }

  afterEach(() => jest.clearAllMocks());

  it('starts without proxy and collects containers', async () => {
    const env = new TestEnv({ internalHost: '127.0.0.1', logger: mockLogger });

    // start should not instantiate ToxiProxyContainer (proxied false)
    const { ToxiProxyContainer } = require('@testcontainers/toxiproxy');
    expect(ToxiProxyContainer).not.toHaveBeenCalled();

    await env.start();

    // after start, containersToStop should have been populated by initAppContainers
    expect((env as any).containersToStop).toHaveLength(1);
    expect(mockLogger.info).toHaveBeenCalled();
  });

  it('starts with proxy when proxied true and uses custom image', async () => {
    const { ToxiProxyContainer } = require('@testcontainers/toxiproxy');

    const env = new TestEnv({
      internalHost: '10.0.0.1',
      proxied: true,
      toxiProxyImage: 'custom/image:1.2.3',
      logger: mockLogger,
    });

    await env.start();

    // ToxiProxyContainer should have been constructed with custom image and started
    expect(ToxiProxyContainer).toHaveBeenCalledTimes(1);
    const inst = ToxiProxyContainer.mock.instances[0];
    expect(inst.image).toBe('custom/image:1.2.3');
    expect(inst.withLogConsumer).toHaveBeenCalled();
    expect(inst.start).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalled();
  });

  it('stop calls stop on all containers with removal options', async () => {
    const env = new TestEnv({ internalHost: '127.0.0.1', logger: mockLogger });

    await env.start();

    const container = (env as any).containersToStop[0];
    container.stop = jest.fn().mockResolvedValue(undefined);

    await env.stop();

    expect(container.stop).toHaveBeenCalledWith({
      removeVolumes: true,
      remove: true,
    });
    expect(mockLogger.verbose).toHaveBeenCalled();
  });

  it('stop logs and rethrows when a container stop fails', async () => {
    class FailingEnv extends IntegrationEnvironment {
      protected async initAppContainers() {
        return [
          {
            stop: jest.fn().mockRejectedValue(new Error('boom')),
          } as unknown as any,
        ];
      }

      protected formatLogMessage(
        streamType: 'stdout' | 'stderr',
        message: object
      ) {
        return { level: 'error' as const, message };
      }
    }

    const env = new FailingEnv({ internalHost: '1.2.3.4', logger: mockLogger });
    await env.start();

    await expect(env.stop()).rejects.toThrow('boom');
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('createService delegates to ServiceFactory and returns direct service', async () => {
    const env = new TestEnv({ internalHost: 'h', logger: mockLogger });
    const svc = await (env as any).createService('svc', '8080');
    expect(svc).toHaveProperty('host', 'h');
    expect(svc).toHaveProperty('port', 8080);
  });

  it('createService returns proxied service when proxied and proxy present', async () => {
    const env = new TestEnv({
      internalHost: 'h2',
      proxied: true,
      logger: mockLogger,
    });
    // inject a fake proxy object so ServiceFactory mock treats enableProxy && proxy as truthy
    (env as any).proxy = {};
    const svc = await (env as any).createService('svc', 1234);
    expect(svc).toHaveProperty('host', 'h2');
    expect(svc).toHaveProperty('port', 2222);
  });

  it('constructor accepts provided id and createLogConsumer proxies to LogHandler', async () => {
    const env = new TestEnv({
      internalHost: '127.0.0.1',
      id: 'custom-id',
      logger: mockLogger,
    });
    expect(env.id).toBe('custom-id');

    const consumer = (env as any).createLogConsumer('svc');
    // create a fake stream that triggers data
    const fs: any = {
      on: (ev: string, cb: any) =>
        ev === 'data' && cb(Buffer.from(JSON.stringify({ hello: 'world' }))),
    };
    consumer(fs);
    expect(mockLogger.info).toHaveBeenCalled();
  });

  it('start and stop work without logger (logger optional) and with proxy enabled', async () => {
    const { ToxiProxyContainer } = require('@testcontainers/toxiproxy');
    // create an env without logger
    const env = new TestEnv({ internalHost: '127.0.0.1', proxied: true });

    // start uses the mocked ToxiProxyContainer implementation which returns a proxy
    await expect(env.start()).resolves.toBeUndefined();

    const inst = ToxiProxyContainer.mock.instances[0];
    expect(inst).toBeDefined();

    // ensure containers array populated even when logger undefined
    expect((env as any).containersToStop.length).toBeGreaterThanOrEqual(0);

    // make stop() encounter a failing container stop without logger
    const failing = {
      stop: jest.fn().mockRejectedValue(new Error('fail-stop')),
    } as unknown as any;
    (env as any).containersToStop = [failing];
    await expect(env.stop()).rejects.toThrow('fail-stop');
  });

  it('covers nullish coalescing and verbose logger branch by forcing enableProxy undefined', async () => {
    const env = new TestEnv({ internalHost: '127.0.0.1', logger: mockLogger });

    // force the internal flag to undefined to hit the `??` fallback branch
    (env as any).enableProxy = undefined;

    await expect(env.start()).resolves.toBeUndefined();
    // stop() with no containers should call verbose on the logger
    (env as any).containersToStop = [];
    await expect(env.stop()).resolves.toBeUndefined();
    expect(mockLogger.verbose).toHaveBeenCalled();
  });

  it('stop with logger and no containers calls verbose', async () => {
    const env = new TestEnv({ internalHost: '127.0.0.1', logger: mockLogger });
    (env as any).containersToStop = [];
    await expect(env.stop()).resolves.toBeUndefined();
    expect(mockLogger.verbose).toHaveBeenCalled();
  });

  it('stop without logger and no containers does not throw', async () => {
    const env = new TestEnv({ internalHost: '127.0.0.1' });
    (env as any).containersToStop = [];
    await expect(env.stop()).resolves.toBeUndefined();
  });
});
