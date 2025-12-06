import { createMinioService } from './minio';

jest.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: jest.fn().mockImplementation(() => ({
      send: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn().mockReturnValue(undefined),
    })),
    CreateBucketCommand: function CreateBucketCommand() {
      return {};
    },
  };
});

describe('createMinioService', () => {
  test('creates bucket and returns s3Client', async () => {
    // Arrange
    const createService = jest
      .fn()
      .mockResolvedValue({ host: '127.0.0.1', port: 9000 });
    const waitToCloses: Array<() => Promise<void>> = [];

    // Act
    const res = await createMinioService({
      id: 'm1',
      createService,
      env: { MINIO_KEY: 'k', MINIO_SECRET: 's' } as any,
      waitToCloses,
    });

    // Assert
    expect(res).toHaveProperty('s3Client');
    expect(res).toHaveProperty('bucketName', 'test-private-m1');
    expect(waitToCloses.length).toBeGreaterThan(0);
    // call teardown to exercise destroy()
    await (waitToCloses[0]() as Promise<void>);
  });

  test('throws when CreateBucket fails', async () => {
    // Arrange
    const mod = require('@aws-sdk/client-s3');
    mod.S3Client.mockImplementationOnce(() => ({
      send: jest.fn().mockRejectedValue(new Error('nope')),
      destroy: jest.fn(),
    }));

    const createService = jest
      .fn()
      .mockResolvedValue({ host: '127.0.0.1', port: 9000 });

    // Act & Assert
    await expect(
      createMinioService({
        id: 'm2',
        createService,
        env: { MINIO_KEY: 'k', MINIO_SECRET: 's' } as any,
      })
    ).rejects.toThrow(/Failed to setup MinIO bucket/);
  });

  test('works when env not provided (uses process.env)', async () => {
    // Arrange
    const mod = require('@aws-sdk/client-s3');
    mod.S3Client.mockImplementationOnce(() => ({
      send: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn(),
    }));
    const createService = jest
      .fn()
      .mockResolvedValue({ host: '127.0.0.1', port: 9000 });

    // ensure process.env keys exist
    const originalKey = process.env.MINIO_KEY;
    const originalSecret = process.env.MINIO_SECRET;
    process.env.MINIO_KEY = 'k';
    process.env.MINIO_SECRET = 's';

    // Act
    const res = await createMinioService({ id: 'm3', createService } as any);

    // Assert
    expect(res).toHaveProperty('s3Client');

    process.env.MINIO_KEY = originalKey;
    process.env.MINIO_SECRET = originalSecret;
  });

  test('respects explicit minioPort when provided', async () => {
    // Arrange
    const mod = require('@aws-sdk/client-s3');
    mod.S3Client.mockImplementationOnce(() => ({
      send: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn(),
    }));
    const createService = jest
      .fn()
      .mockResolvedValue({ host: '127.0.0.1', port: 9001 });

    // Act
    const res = await createMinioService({
      id: 'm-port',
      createService,
      minioPort: 9001,
      env: { MINIO_KEY: 'k', MINIO_SECRET: 's' } as any,
    } as any);

    // Assert
    expect(res).toHaveProperty('s3Client');
  });

  test('works when createService returns empty service (missing host/port)', async () => {
    // Arrange
    const mod = require('@aws-sdk/client-s3');
    mod.S3Client.mockImplementationOnce(() => ({
      send: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn().mockReturnValue(undefined),
    }));

    const createService = jest.fn().mockResolvedValue({});

    // Act
    const res = await createMinioService({
      id: 'm-empty',
      createService,
      env: { MINIO_KEY: 'k', MINIO_SECRET: 's' } as any,
    } as any);

    // Assert
    expect(res).toHaveProperty('s3Client');
    expect(res).toHaveProperty('bucketName', 'test-private-m-empty');
  });

  test('teardown throws when s3Client.destroy throws synchronously', async () => {
    // Arrange
    const mod = require('@aws-sdk/client-s3');
    mod.S3Client.mockImplementationOnce(() => ({
      send: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn().mockImplementation(() => {
        throw new Error('destroy-bang');
      }),
    }));

    const createService = jest
      .fn()
      .mockResolvedValue({ host: '127.0.0.1', port: 9000 });

    const waitToCloses: Array<() => Promise<void>> = [];

    // Act
    const res = await createMinioService({
      id: 'm-destroy-fail',
      createService,
      env: { MINIO_KEY: 'k', MINIO_SECRET: 's' } as any,
      waitToCloses,
    } as any);

    // Assert
    expect(res).toHaveProperty('s3Client');
    // calling teardown should propagate the synchronous throw
    expect(() => waitToCloses[0]()).toThrow(/destroy-bang/);
  });
});
