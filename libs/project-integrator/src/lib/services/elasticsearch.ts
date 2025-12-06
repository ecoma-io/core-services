import { Client as ElasticsearchClient } from '@elastic/elasticsearch';
import { MaybeAsync } from '@ecoma-io/common';
import { IProxiedService, IService } from '@ecoma-io/integrator';

export type IElasticsearchService =
  | (IProxiedService & {
      elasticsearchClient: ElasticsearchClient;
      indexName: string;
    })
  | (IService & {
      elasticsearchClient: ElasticsearchClient;
      indexName: string;
    });

export interface ICreateElasticsearchOpts {
  id: string;
  createService: (
    name: string,
    port?: string | number
  ) => Promise<IProxiedService | IService>;
  elasticPort?: string | number;
  env?: NodeJS.ProcessEnv;
  waitToCloses?: Array<() => MaybeAsync<void>>;
}

export async function createElasticsearchService(
  opts: ICreateElasticsearchOpts
): Promise<IElasticsearchService> {
  const {
    id,
    createService,
    elasticPort,
    env = process.env,
    waitToCloses = [],
  } = opts;

  const service = await createService(
    `elasticsearch-${id}`,
    elasticPort ?? env['ELASTIC_PORT']
  );
  const indexName = `test_${id}`;

  const svc = service as unknown as Record<string, unknown>;
  const host = String(svc.host ?? '');
  const port = String(svc.port ?? '');

  const elasticsearchClient = new ElasticsearchClient({
    node: `http://${host}:${port}`,
    auth: {
      username: 'elastic',
      password: env['ELASTIC_PASSWORD'] as string,
    },
  });

  try {
    await elasticsearchClient.ping();
    try {
      if (
        elasticsearchClient.indices &&
        typeof elasticsearchClient.indices.create === 'function'
      ) {
        await elasticsearchClient.indices.create({ index: indexName });
      }
    } catch {
      // ignore index creation errors (may already exist)
    }
  } catch (error) {
    throw new Error(`Failed to connect to Elasticsearch: ${error}`);
  }

  waitToCloses.push(async (): Promise<void> => {
    await elasticsearchClient.close();
  });

  return {
    elasticsearchClient,
    indexName,
    ...(service as unknown as object),
  } as IElasticsearchService;
}
