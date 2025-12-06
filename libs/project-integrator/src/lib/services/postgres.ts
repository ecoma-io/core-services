import { DataSource } from 'typeorm';
import { Client } from 'pg';
import { MaybeAsync } from '@ecoma-io/common';
import { IProxiedService, IService } from '@ecoma-io/integrator';

export type IPostgresService =
  | (IProxiedService & { dataSource: DataSource; databaseName: string })
  | (IService & { dataSource: DataSource; databaseName: string });

export interface ICreatePostgresOpts {
  id: string;
  createService: (
    name: string,
    port?: string | number
  ) => Promise<IProxiedService | IService>;
  postgresPort?: string | number;
  env?: NodeJS.ProcessEnv;
  waitToCloses?: Array<() => MaybeAsync<void>>;
}

export async function createPostgresService(
  opts: ICreatePostgresOpts
): Promise<IPostgresService> {
  const {
    id,
    createService,
    postgresPort,
    env = process.env,
    waitToCloses = [],
  } = opts;

  const service = await createService(
    `postgres-${id}`,
    postgresPort ?? env['POSTGRES_PORT']
  );
  const databaseName = `test_${id}`;

  const svc = service as unknown as Record<string, unknown>;
  const host = String(svc.host ?? '');
  const port = Number(svc.port ?? 0);

  const client = new Client({
    host,
    port,
    user: env['POSTGRES_USERNAME'],
    password: env['POSTGRES_PASSWORD'],
  });

  try {
    await client.connect();
    await client.query(`CREATE DATABASE "${databaseName}";`);
  } catch (error) {
    throw new Error(`Failed to initialize Postgres database: ${error}`);
  } finally {
    try {
      await client.end();
    } catch {
      // ignore
    }
  }

  const dataSource = new DataSource({
    type: 'postgres',
    host,
    port,
    username: env['POSTGRES_USERNAME'],
    password: env['POSTGRES_PASSWORD'],
    database: databaseName,
  });

  try {
    await dataSource.initialize();
  } catch (error) {
    throw new Error(`Failed to connect to test database: ${error}`);
  }

  waitToCloses.push(async () => {
    await dataSource.destroy();
  });

  return {
    dataSource,
    databaseName,
    ...(service as unknown as object),
  } as IPostgresService;
}
