import axios, { AxiosInstance } from 'axios';
import { MaybeAsync } from '@ecoma-io/common';
import { IProxiedService, IService } from '@ecoma-io/integrator';

export type IMaildevService =
  | (IProxiedService & { client: AxiosInstance })
  | (IService & { client: AxiosInstance });

export interface ICreateMaildevOpts {
  id: string;
  createService: (
    name: string,
    port?: string | number
  ) => Promise<IProxiedService | IService>;
  maildevPort?: string | number;
  env?: NodeJS.ProcessEnv;
  waitToCloses?: Array<() => MaybeAsync<void>>;
}

export async function createMaildevService(
  opts: ICreateMaildevOpts
): Promise<IMaildevService> {
  const {
    id,
    createService,
    maildevPort,
    env = process.env,
    waitToCloses = [],
  } = opts;

  const service = await createService(
    `maildev-${id}`,
    maildevPort ?? env['MAILDEV_PORT']
  );

  const svc = service as unknown as Record<string, unknown>;
  const host = String(svc.host ?? '');
  const webPort = String(env['MAILDEV_WEB_PORT'] ?? '');

  let client: AxiosInstance;
  try {
    client = axios.create({ baseURL: `http://${host}:${webPort}` });
  } catch (err) {
    throw new Error(`Failed to create Maildev HTTP client: ${String(err)}`);
  }

  // No special teardown required for Axios, but keep pattern consistent
  waitToCloses.push(() => {
    // noop for axios, kept for symmetry with other services
    void 0;
  });

  return {
    client,
    ...(service as unknown as object),
  } as IMaildevService;
}
