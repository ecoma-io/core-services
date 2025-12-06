import { S3Client, CreateBucketCommand } from '@aws-sdk/client-s3';
import { MaybeAsync } from '@ecoma-io/common';
import { IProxiedService, IService } from '@ecoma-io/integrator';

export type IMinioService =
  | (IProxiedService & { bucketName: string; s3Client: S3Client })
  | (IService & { bucketName: string; s3Client: S3Client });

export interface ICreateMinioOpts {
  id: string;
  createService: (
    name: string,
    port?: string | number
  ) => Promise<IProxiedService | IService>;
  minioPort?: string | number;
  env?: NodeJS.ProcessEnv;
  waitToCloses?: Array<() => MaybeAsync<void>>;
}

export async function createMinioService(
  opts: ICreateMinioOpts
): Promise<IMinioService> {
  const {
    id,
    createService,
    minioPort,
    env = process.env,
    waitToCloses = [],
  } = opts;

  const service = await createService(
    `minio-${id}`,
    minioPort ?? env['MINIO_PORT']
  );

  const svc = service as unknown as Record<string, unknown>;
  const host = String(svc.host ?? '');
  const port = String(svc.port ?? '');

  const s3Client = new S3Client({
    endpoint: `http://${host}:${port}`,
    region: 'us-east-1',
    credentials: {
      accessKeyId: env['MINIO_KEY'] as string,
      secretAccessKey: env['MINIO_SECRET'] as string,
    },
    forcePathStyle: true,
  });

  const bucketName = `test-private-${id}`;

  try {
    await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
  } catch (error) {
    throw new Error(`Failed to setup MinIO bucket: ${error}`);
  }

  waitToCloses.push(() => {
    s3Client.destroy();
  });

  return {
    bucketName,
    s3Client,
    ...(service as unknown as object),
  } as IMinioService;
}
