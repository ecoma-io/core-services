import { MaybeAsync } from '@ecoma-io/common';
import { IProxiedService, IService } from '@ecoma-io/integrator';
import { Redis } from 'ioredis';

export type IRedisService =
  | (IProxiedService & { redis: Redis })
  | (IService & { redis: Redis });

export interface ICreateRedisOpts {
  id: string;
  createService: (
    name: string,
    port?: string | number
  ) => Promise<IProxiedService | IService>;
  redisPort?: string | number;
  env?: NodeJS.ProcessEnv;
  waitToCloses?: Array<() => MaybeAsync<void>>;
}

export async function createRedisService(
  opts: ICreateRedisOpts
): Promise<IRedisService> {
  const {
    id,
    createService,
    redisPort,
    env = process.env,
    waitToCloses = [],
  } = opts;

  const service = await createService(
    `redis-${id}`,
    redisPort ?? env['REDIS_PORT']
  );

  const svc = service as unknown as Record<string, unknown>;
  const host = String(svc.host ?? '');
  const port = Number(svc.port ?? 0);

  const redis = new Redis({
    host,
    port,
    password: env['REDIS_PASSWORD'],
    keyPrefix: `test_${id}_`,
  });

  try {
    const dbIndex =
      (id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % 15) +
      1;
    await redis.select(dbIndex);
    await redis.set(`test_${id}`, 'initialized');
  } catch (error) {
    throw new Error(`Failed to initialize Redis: ${error}`);
  }

  waitToCloses.push(async () => {
    await redis.quit();
  });

  return { redis, ...(service as unknown as object) } as IRedisService;
}
