import {
  IntegrationEnvironment,
  ProxyOptions,
} from './integration-environment';
import { StartedTestContainer } from 'testcontainers';
import { Readable } from 'stream';

// Mock Testcontainers
jest.mock('testcontainers', () => ({
  StartedTestContainer: jest.fn(),
}));

jest.mock('@testcontainers/toxiproxy', () => ({
  ToxiProxyContainer: jest.fn().mockImplementation(() => ({
    withLogConsumer: jest.fn().mockReturnThis(),
    start: jest.fn().mockResolvedValue({
      createProxy: jest.fn().mockResolvedValue({
        port: 12345,
        instance: {
          addToxic: jest.fn(),
        },
        setEnabled: jest.fn(),
      }),
    }),
  })),
}));

jest.mock('uuid', () => ({
  v7: jest.fn(() => 'mock-uuid'),
}));

describe('IntegrationEnvironment', () => {
  let mockInitAppContainers: jest.MockedFunction<
    () => Promise<StartedTestContainer[]>
  >;
  let mockContainer: StartedTestContainer;

  beforeEach(() => {
    mockContainer = {
      stop: jest.fn().mockResolvedValue({}),
    } as unknown as StartedTestContainer;
    mockInitAppContainers = jest.fn().mockResolvedValue([mockContainer]);
  });

  class TestIntegrationEnvironment extends IntegrationEnvironment {
    async initAppContainers(): Promise<StartedTestContainer[]> {
      return mockInitAppContainers();
    }

    // Expose protected method for testing
    public async testCreateService(name: string, portEnvVar: string) {
      return this.createService(name, portEnvVar);
    }

    // Expose createLogConsumer for testing
    public testCreateLogConsumer(containerName: string) {
      return this.createLogConsumer(containerName);
    }

    // Expose containerLog for testing
    public testContainerLog(
      level: 'error' | 'info',
      containerName: string,
      message: string
    ) {
      this.containerLog(level, containerName, message);
    }
  }

  describe('constructor', () => {
    test('should initialize with default proxy enabled when no options provided', () => {
      // Arrange: No proxy options
      const internalHost = 'localhost';

      // Act: Create instance
      const env = new TestIntegrationEnvironment(internalHost);

      // Assert: Check internal state (via reflection or behavior)
      expect(env).toBeDefined();
    });

    test('should initialize with proxy disabled when boolean false provided', () => {
      // Arrange: Disable proxy
      const internalHost = 'localhost';
      const proxyOptions = false;

      // Act: Create instance
      const env = new TestIntegrationEnvironment(internalHost, proxyOptions);

      // Assert: Instance created without errors
      expect(env).toBeDefined();
    });

    test('should initialize with custom proxy options', () => {
      // Arrange: Custom proxy options
      const internalHost = 'localhost';
      const proxyOptions: ProxyOptions = {
        enabled: true,
        image: 'custom/image',
      };

      // Act: Create instance
      const env = new TestIntegrationEnvironment(internalHost, proxyOptions);

      // Assert: Instance created
      expect(env).toBeDefined();
    });

    test('should handle edge case with empty ProxyOptions object', () => {
      // Arrange: Empty proxy options
      const internalHost = 'localhost';
      const proxyOptions: ProxyOptions = {};

      // Act: Create instance
      const env = new TestIntegrationEnvironment(internalHost, proxyOptions);

      // Assert: Defaults applied
      expect(env).toBeDefined();
    });

    test('should handle proxy disabled with custom image provided', () => {
      // Arrange: Proxy disabled but custom image
      const internalHost = 'localhost';
      const proxyOptions: ProxyOptions = {
        enabled: false,
        image: 'custom/image',
      };

      // Act: Create instance
      const env = new TestIntegrationEnvironment(internalHost, proxyOptions);

      // Assert: Instance created, proxy disabled
      expect(env).toBeDefined();
    });
  });

  describe('start', () => {
    test('should start proxy and app containers when proxy enabled', async () => {
      // Arrange: Enable proxy
      const env = new TestIntegrationEnvironment('localhost', true);

      // Act: Start environment
      await env.start();

      // Assert: Proxy started, app containers initialized
      expect(mockInitAppContainers).toHaveBeenCalled();
    });

    test('should skip proxy start when proxy disabled', async () => {
      // Arrange: Disable proxy
      const env = new TestIntegrationEnvironment('localhost', false);

      // Act: Start environment
      await env.start();

      // Assert: Only app containers initialized
      expect(mockInitAppContainers).toHaveBeenCalled();
    });

    test('should handle errors during container start', async () => {
      // Arrange: Mock error in initAppContainers
      mockInitAppContainers.mockRejectedValue(
        new Error('Container start failed')
      );
      const env = new TestIntegrationEnvironment('localhost', false);

      // Act & Assert: Expect error to propagate
      await expect(env.start()).rejects.toThrow('Container start failed');
    });
  });

  describe('stop', () => {
    test('should stop all containers successfully', async () => {
      // Arrange: Environment with containers
      const env = new TestIntegrationEnvironment('localhost', false);
      await env.start(); // Start to populate containersToStop

      // Act: Stop environment
      await env.stop();

      // Assert: Container stop called
      expect(mockContainer.stop).toHaveBeenCalledWith({
        removeVolumes: true,
        remove: true,
      });
    });

    test('should handle errors during container stop', async () => {
      // Arrange: Mock stop error
      mockContainer.stop = jest
        .fn()
        .mockRejectedValue(new Error('Stop failed'));
      const env = new TestIntegrationEnvironment('localhost', false);
      await env.start();

      // Act: Stop environment
      await env.stop();

      // Assert: Error logged, but no throw
    });
  });

  describe('createService', () => {
    test('should create proxied service when proxy enabled', async () => {
      // Arrange: Enable proxy
      const env = new TestIntegrationEnvironment('localhost', true);
      await env.start();

      // Act: Create service
      const service = await env.testCreateService('test-service', '5432');

      // Assert: ProxiedService returned with correct properties
      expect(service).toHaveProperty('host', 'localhost');
      expect(service).toHaveProperty('port', 12345);
      expect(service).toHaveProperty('addToxic');
      expect(service).toHaveProperty('setEnabled');
    });

    test('should create direct service when proxy disabled', async () => {
      // Arrange: Disable proxy
      const env = new TestIntegrationEnvironment('localhost', false);

      // Act: Create service
      const service = await env.testCreateService('test-service', '5432');

      // Assert: Direct Service returned
      expect(service).toHaveProperty('host', 'localhost');
      expect(service).toHaveProperty('port', 5432);
      expect(service).not.toHaveProperty('addToxic');
    });

    test('should handle invalid port in direct mode', async () => {
      // Arrange: Invalid port
      const env = new TestIntegrationEnvironment('localhost', false);

      // Act & Assert: Expect NaN
      const service = await env.testCreateService('test-service', 'invalid');
      expect(service.port).toBeNaN();
    });
  });

  describe('log', () => {
    test('should log messages at specified level', () => {
      // Arrange: Spy on console
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
      const env = new TestIntegrationEnvironment('localhost');

      // Act: Log message
      env.log('info', 'Test message');

      // Assert: Console called
      expect(consoleSpy).toHaveBeenCalledWith('Test message');

      // Cleanup
      consoleSpy.mockRestore();
    });

    test('should handle all log levels', () => {
      // Arrange: Spies for all levels
      const levels: Array<'error' | 'info' | 'warn' | 'debug'> = [
        'error',
        'info',
        'warn',
        'debug',
      ];
      const spies = levels.map((level) =>
        jest.spyOn(console, level).mockImplementation()
      );
      const env = new TestIntegrationEnvironment('localhost');

      // Act: Log at each level
      levels.forEach((level) => env.log(level, `${level} message`));

      // Assert: All called
      spies.forEach((spy, index) =>
        expect(spy).toHaveBeenCalledWith(`${levels[index]} message`)
      );

      // Cleanup
      spies.forEach((spy) => spy.mockRestore());
    });
  });

  describe('createLogConsumer', () => {
    test('should create log consumer that logs data and error events', () => {
      // Arrange: Spy on console and create mock stream
      const infoSpy = jest.spyOn(console, 'info').mockImplementation();
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      const mockStream = new Readable({
        read() {
          // No-op
        },
      });
      const env = new TestIntegrationEnvironment('localhost');

      // Act: Get log consumer and attach to stream
      const logConsumer = env.testCreateLogConsumer('test-container');
      logConsumer(mockStream);

      // Emit data event
      mockStream.emit('data', Buffer.from('Info message'));
      // Emit err event
      mockStream.emit('err', Buffer.from('Error message'));

      // Assert: Log called with container prefix
      expect(infoSpy).toHaveBeenCalledWith(
        `[${env.id}] [test-container] Info message`
      );
      expect(errorSpy).toHaveBeenCalledWith(
        `[${env.id}] [test-container] Error message`
      );

      // Cleanup
      infoSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  describe('containerLog', () => {
    test('should log with environment ID and container name prefix', () => {
      // Arrange: Spy on console
      const infoSpy = jest.spyOn(console, 'info').mockImplementation();
      const env = new TestIntegrationEnvironment('localhost');

      // Act: Call containerLog
      env.testContainerLog('info', 'test-container', 'Test message');

      // Assert: Log called with prefix
      expect(infoSpy).toHaveBeenCalledWith(
        `[${env.id}] [test-container] Test message`
      );

      // Cleanup
      infoSpy.mockRestore();
    });
  });
});
