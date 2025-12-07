import { createMaildevService } from './maildev';

// Mock axios to avoid real HTTP clients in unit tests
jest.mock('axios');
const mockedAxios = jest.requireMock('axios') as { create: jest.Mock };

describe('createMaildevService', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  test('creates service and returns client attached (happy path)', async (): Promise<void> => {
    // Arrange
    const fakeClient = { get: jest.fn() };
    mockedAxios.create.mockReturnValue(fakeClient);

    const mockService = { host: '127.0.0.1', port: 2525 };
    const createService = jest.fn().mockResolvedValue(mockService);
    const waitToCloses: Array<() => void> = [];

    const opts = {
      id: 'test-id',
      createService,
      maildevPort: '4567',
      env: { MAILDEV_WEB_PORT: '1080' } as NodeJS.ProcessEnv,
      waitToCloses,
    } as const;

    // Act
    const svc = await createMaildevService(opts as any);

    // Assert
    expect(createService).toHaveBeenCalledWith('maildev-test-id', '4567');
    expect(svc.client).toBe(fakeClient);
    // waitToCloses should receive one entry (no-op for axios)
    expect(waitToCloses).toHaveLength(1);
  });

  test('throws when axios.create fails', async (): Promise<void> => {
    // Arrange
    mockedAxios.create.mockImplementation(() => {
      throw new Error('boom');
    });

    const mockService = { host: '127.0.0.1', port: 2525 };
    const createService = jest.fn().mockResolvedValue(mockService);

    const opts = {
      id: 'err-id',
      createService,
      maildevPort: '4567',
      env: { MAILDEV_WEB_PORT: '1080' } as NodeJS.ProcessEnv,
      waitToCloses: [],
    } as const;

    // Act & Assert
    await expect(createMaildevService(opts as any)).rejects.toThrow(
      'Failed to create Maildev HTTP client'
    );
  });

  test('uses MAILDEV_PORT from env when maildevPort not provided', async (): Promise<void> => {
    // Arrange
    const fakeClient = { get: jest.fn() };
    mockedAxios.create.mockReturnValue(fakeClient);

    const mockService = { host: '127.0.0.1', port: 2525 };
    const createService = jest.fn().mockResolvedValue(mockService);
    const env = {
      MAILDEV_PORT: '9999',
      MAILDEV_WEB_PORT: '1080',
    } as NodeJS.ProcessEnv;

    const opts = {
      id: 'env-id',
      createService,
      // maildevPort omitted to exercise env fallback
      env,
      waitToCloses: [],
    } as any;

    // Act
    const svc = await createMaildevService(opts);

    // Assert
    expect(createService).toHaveBeenCalledWith('maildev-env-id', '9999');
    expect(svc.client).toBe(fakeClient);
  });

  test('propagates error when createService rejects', async (): Promise<void> => {
    // Arrange
    const createService = jest.fn().mockRejectedValue(new Error('svc-fail'));
    const opts = {
      id: 'bad-id',
      createService,
      maildevPort: '1111',
      env: { MAILDEV_WEB_PORT: '1080' } as NodeJS.ProcessEnv,
      waitToCloses: [],
    } as const;

    // Act & Assert
    await expect(createMaildevService(opts as any)).rejects.toThrow('svc-fail');
  });

  test('returned object preserves service fields and cleanup is noop', async (): Promise<void> => {
    // Arrange
    const fakeClient = { get: jest.fn() };
    mockedAxios.create.mockReturnValue(fakeClient);

    const mockService = {
      host: '10.0.0.5',
      port: 2526,
      someField: 'x',
    } as Record<string, unknown>;
    const createService = jest.fn().mockResolvedValue(mockService);
    const waitToCloses: Array<() => void> = [];

    const opts = {
      id: 'preserve-id',
      createService,
      maildevPort: '2222',
      env: { MAILDEV_WEB_PORT: '8080' } as NodeJS.ProcessEnv,
      waitToCloses,
    } as any;

    // Act
    const svc = await createMaildevService(opts);

    // Assert: preserves original fields
    expect((svc as any).host).toBe('10.0.0.5');
    expect((svc as any).port).toBe(2526);
    expect((svc as any).someField).toBe('x');
    // client present
    expect(svc.client).toBe(fakeClient);

    // cleanup function was pushed and is callable and noop
    expect(waitToCloses).toHaveLength(1);
    expect(() => waitToCloses[0]()).not.toThrow();
  });

  test('calls axios.create with empty webPort when MAILDEV_WEB_PORT missing', async (): Promise<void> => {
    // Arrange
    const fakeClient = { get: jest.fn() };
    mockedAxios.create.mockReturnValue(fakeClient);

    const mockService = { host: '1.2.3.4', port: 2525 };
    const createService = jest.fn().mockResolvedValue(mockService);
    const env = { MAILDEV_PORT: '3333' } as NodeJS.ProcessEnv; // MAILDEV_WEB_PORT missing

    const opts = {
      id: 'nop-webport',
      createService,
      env,
      waitToCloses: [],
    } as any;

    // Act
    await createMaildevService(opts);

    // Assert: axios.create called with baseURL where webPort is empty string
    expect(mockedAxios.create).toHaveBeenCalledTimes(1);
    const callArg = mockedAxios.create.mock.calls[0][0];
    expect(callArg).toHaveProperty('baseURL');
    expect(callArg.baseURL).toBe('http://1.2.3.4:');
  });

  test('handles missing host from createService (empty host)', async (): Promise<void> => {
    // Arrange
    const fakeClient = { get: jest.fn() };
    mockedAxios.create.mockReturnValue(fakeClient);

    // createService returns an object without host
    const mockService = { port: 2525 } as Record<string, unknown>;
    const createService = jest.fn().mockResolvedValue(mockService);
    const env = {
      MAILDEV_PORT: '4444',
      MAILDEV_WEB_PORT: '8081',
    } as NodeJS.ProcessEnv;

    const opts = {
      id: 'no-host',
      createService,
      env,
      waitToCloses: [],
    } as any;

    // Act
    const svc = await createMaildevService(opts);

    // Assert: axios called with empty host portion
    expect(mockedAxios.create).toHaveBeenCalled();
    const base = mockedAxios.create.mock.calls[0][0].baseURL;
    expect(base).toBe('http://:8081');
    expect(svc.client).toBe(fakeClient);
  });

  test('uses process.env when env option omitted', async (): Promise<void> => {
    // Arrange
    const origMaildevPort = process.env.MAILDEV_PORT;
    const origMaildevWebPort = process.env.MAILDEV_WEB_PORT;
    try {
      process.env.MAILDEV_PORT = '5555';
      process.env.MAILDEV_WEB_PORT = '9090';

      const fakeClient = { get: jest.fn() };
      mockedAxios.create.mockReturnValue(fakeClient);

      const mockService = { host: '9.9.9.9', port: 2525 };
      const createService = jest.fn().mockResolvedValue(mockService);

      const opts = {
        id: 'proc-env',
        createService,
        // env omitted to use process.env
        waitToCloses: [],
      } as any;

      // Act
      const svc = await createMaildevService(opts);

      // Assert
      expect(createService).toHaveBeenCalledWith('maildev-proc-env', '5555');
      expect(svc.client).toBe(fakeClient);
      const base = mockedAxios.create.mock.calls[0][0].baseURL;
      expect(base).toBe('http://9.9.9.9:9090');
    } finally {
      // Restore env
      process.env.MAILDEV_PORT = origMaildevPort;
      process.env.MAILDEV_WEB_PORT = origMaildevWebPort;
    }
  });

  test('existing waitToCloses entries remain and are callable', async (): Promise<void> => {
    // Arrange
    const fakeClient = { get: jest.fn() };
    mockedAxios.create.mockReturnValue(fakeClient);

    const mockService = { host: '10.10.10.10', port: 2525 };
    const createService = jest.fn().mockResolvedValue(mockService);

    let called = false;
    const existingCleanup = () => {
      called = true;
      return undefined;
    };

    const waitToCloses: Array<() => void> = [existingCleanup];

    const opts = {
      id: 'with-existing-cleanup',
      createService,
      maildevPort: '6666',
      env: { MAILDEV_WEB_PORT: '3000' } as NodeJS.ProcessEnv,
      waitToCloses,
    } as any;

    // Act
    const svc = await createMaildevService(opts);

    // Assert: original cleanup still present and callable
    expect(waitToCloses).toHaveLength(2);
    // call both
    expect(() => waitToCloses[0]()).not.toThrow();
    expect(called).toBe(true);
    // new cleanup is noop
    expect(() => waitToCloses[1]()).not.toThrow();
    expect(svc.client).toBe(fakeClient);
  });

  test('omitting waitToCloses uses default array (covers default-arg branch)', async (): Promise<void> => {
    // Arrange
    const fakeClient = { get: jest.fn() };
    mockedAxios.create.mockReturnValue(fakeClient);

    const mockService = { host: '127.0.0.1', port: 2525 };
    const createService = jest.fn().mockResolvedValue(mockService);

    const opts = {
      id: 'default-wt',
      createService,
      maildevPort: '7777',
      env: { MAILDEV_WEB_PORT: '7070' } as NodeJS.ProcessEnv,
      // waitToCloses omitted intentionally
    } as any;

    // Act
    const svc = await createMaildevService(opts);

    // Assert
    expect(createService).toHaveBeenCalledWith('maildev-default-wt', '7777');
    expect(svc.client).toBe(fakeClient);
  });
});
