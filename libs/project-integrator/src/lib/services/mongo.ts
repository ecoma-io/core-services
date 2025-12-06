import { MongoClient, Db } from 'mongodb';
import { MaybeAsync } from '@ecoma-io/common';
import { IProxiedService, IService } from '@ecoma-io/integrator';

export type IMongoService =
  | (IProxiedService & {
      mongoClient: MongoClient;
      db: Db;
      databaseName: string;
    })
  | (IService & { mongoClient: MongoClient; db: Db; databaseName: string });

export interface ICreateMongoOpts {
  id: string;
  createService: (
    name: string,
    port?: string | number
  ) => Promise<IProxiedService | IService>;
  mongoPort?: string | number;
  env?: NodeJS.ProcessEnv;
  waitToCloses?: Array<() => MaybeAsync<void>>;
}

export async function createMongoService(
  opts: ICreateMongoOpts
): Promise<IMongoService> {
  const {
    id,
    createService,
    mongoPort,
    env = process.env,
    waitToCloses = [],
  } = opts;

  const service = await createService(
    `mongo-${id}`,
    mongoPort ?? env['MONGO_PORT']
  );
  const databaseName = `test_${id}`;

  const svc = service as unknown as Record<string, unknown>;
  const host = String(svc.host ?? '');
  const port = String(svc.port ?? '');
  const connectionString = `mongodb://${env['MONGO_USERNAME']}:${env['MONGO_PASSWORD']}@${host}:${port}`;

  let mongoClient: MongoClient;
  try {
    mongoClient = new MongoClient(connectionString as string);
    await mongoClient.connect();
  } catch (error) {
    throw new Error(`Failed to connect to MongoDB: ${error}`);
  }

  const db = mongoClient.db(databaseName);

  waitToCloses.push(async (): Promise<void> => {
    await mongoClient.close();
  });

  return {
    mongoClient,
    db,
    databaseName,
    ...(service as unknown as object),
  } as IMongoService;
}
