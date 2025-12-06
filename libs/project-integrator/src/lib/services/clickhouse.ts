import { MaybeAsync } from '@ecoma-io/common';
import { IProxiedService, IService } from '@ecoma-io/integrator';
import { createClient } from '@clickhouse/client';

export type IClickhouseService =
  | (IProxiedService & { clickhouseClient: any; databaseName: string })
  | (IService & { clickhouseClient: any; databaseName: string });

export interface ICreateClickhouseOpts {
  id: string;
  createService: (
    name: string,
    port?: string | number
  ) => Promise<IProxiedService | IService>;
  clickhousePort?: string | number;
  env?: NodeJS.ProcessEnv;
  waitToCloses?: Array<() => MaybeAsync<void>>;
}

export async function createClickhouseService(
  opts: ICreateClickhouseOpts
): Promise<IClickhouseService> {
  const {
    id,
    createService,
    clickhousePort,
    env = process.env,
    waitToCloses = [],
  } = opts;

  const service = await createService(
    `clickhouse-${id}`,
    clickhousePort ?? env['CLICK_HOUSE_HTTP_PORT']
  );

  const databaseName = `test_${id}`;

  const svc = service as unknown as Record<string, unknown>;
  const host = String(svc.host ?? '');
  const port = String(svc.port ?? '');

  const client = createClient({
    host: `http://${host}:${port}`,
    username: env['CLICK_HOUSE_USER'],
    password: env['CLICK_HOUSE_PASSWORD'],
  });

  try {
    // Create isolated database for testing
    await client.exec({
      query: `CREATE DATABASE IF NOT EXISTS ${databaseName}`,
    });
  } catch (error) {
    throw new Error(`Failed to initialize ClickHouse database: ${error}`);
  }

  waitToCloses.push(async (): Promise<void> => {
    if (typeof (client as any).close === 'function') {
      await (client as any).close();
    }
  });

  return {
    clickhouseClient: client,
    databaseName,
    ...(service as unknown as object),
  } as IClickhouseService;
}
