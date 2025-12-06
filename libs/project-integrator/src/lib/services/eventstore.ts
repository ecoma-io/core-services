import { EventStoreDBClient } from '@eventstore/db-client';
import { MaybeAsync } from '@ecoma-io/common';
import { IProxiedService, IService } from '@ecoma-io/integrator';

export type IEventStoreService =
  | (IProxiedService & {
      eventStoreClient: EventStoreDBClient;
      streamPrefix: string;
    })
  | (IService & { eventStoreClient: EventStoreDBClient; streamPrefix: string });

export interface ICreateEventStoreOpts {
  id: string;
  createService: (
    name: string,
    port?: string | number
  ) => Promise<IProxiedService | IService>;
  esdbPort?: string | number;
  env?: NodeJS.ProcessEnv;
  waitToCloses?: Array<() => MaybeAsync<void>>;
}

export async function createEventStoreService(
  opts: ICreateEventStoreOpts
): Promise<IEventStoreService> {
  const {
    id,
    createService,
    esdbPort,
    env = process.env,
    waitToCloses = [],
  } = opts;

  const service = await createService(
    `eventstoredb-${id}`,
    esdbPort ?? env['ESDB_HTTP_PORT']
  );
  const streamPrefix = `test_${id}`;

  const svc = service as unknown as Record<string, unknown>;
  const host = String(svc.host ?? '');
  const port = String(svc.port ?? '');

  const eventStoreClient = EventStoreDBClient.connectionString(
    `esdb://${host}:${port}?tls=false`
  );

  waitToCloses.push((): void => {
    try {
      eventStoreClient.dispose();
    } catch {
      // ignore
    }
  });

  return {
    eventStoreClient,
    streamPrefix,
    ...(service as unknown as object),
  } as IEventStoreService;
}
