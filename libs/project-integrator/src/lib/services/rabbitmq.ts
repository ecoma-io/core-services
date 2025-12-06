import * as http from 'http';
import * as amqp from 'amqplib';
import { MaybeAsync } from '@ecoma-io/common';
import { IProxiedService, IService } from '@ecoma-io/integrator';

export type IRabbitMQService =
  | (IProxiedService & {
      connection: amqp.ChannelModel;
      channel: amqp.Channel;
      vhost: string;
    })
  | (IService & {
      connection: amqp.ChannelModel;
      channel: amqp.Channel;
      vhost: string;
    });

export interface ICreateRabbitMQOpts {
  id: string;
  createService: (
    name: string,
    port?: string | number
  ) => Promise<IProxiedService | IService>;
  amqpPort?: string | number;
  mgmtPort?: string | number;
  env?: NodeJS.ProcessEnv;
  waitToCloses?: Array<() => MaybeAsync<void>>;
}

/**
 * Convert an unknown value to a finite numeric status code.
 *
 * This function attempts to coerce the provided value to a Number and returns
 * it only if it is a finite numeric value. Any null/undefined input, values
 * that coerce to NaN, or infinite values will produce a fallback value of 0.
 *
 * @param code - The value to convert to a numeric status code (may be any type).
 * @returns A finite number representing the status code, or 0 if the input is null,
 *          undefined, non-numeric, NaN, or ±Infinity.
 *
 * @example
 * ```ts
 * statusCodeToNumber("200"); // 200
 * statusCodeToNumber(404);   // 404
 * statusCodeToNumber(true);  // 1
 * statusCodeToNumber("foo"); // 0
 * statusCodeToNumber(null);  // 0
 * statusCodeToNumber(Infinity); // 0
 * ```
 */
function statusCodeToNumber(code: unknown): number {
  if (code === null || code === undefined) return 0;
  const n = Number(code as unknown);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Determines whether a status (obtained via the provided getter) represents an HTTP "OK" range.
 *
 * The function calls the supplied `getter` twice, converts each result to a numeric status
 * using `statusCodeToNumber`, and returns `true` only if the first numeric result is
 * greater than or equal to 200 and the second numeric result is less than 300.
 *
 * Note:
 * - `getter` is invoked twice; it should be free of side effects or idempotent when used here,
 *   otherwise the two invocations may produce different values and affect the result.
 * - Conversion is performed by `statusCodeToNumber`. Any exceptions thrown by that helper
 *   or by `getter` will propagate to the caller.
 * - If conversion yields `NaN`, comparisons will evaluate to `false`, and the function will
 *   therefore return `false`.
 *
 * @param getter - A function that returns a value representing a status code (will be passed
 *                 to `statusCodeToNumber` for numeric conversion). It is called twice.
 * @returns `true` if the first converted status is >= 200 and the second converted status is < 300;
 *          otherwise `false`.
 */
function isStatusOkFromGetter(getter: () => unknown): boolean {
  const left = statusCodeToNumber(getter());
  const right = statusCodeToNumber(getter());
  return left >= 200 && right < 300;
}

export async function ensureRabbitMqVhost(
  host: string,
  port: number,
  vhost: string,
  username: string,
  password: string
): Promise<void> {
  const auth = Buffer.from(`${username}:${password}`).toString('base64');

  // Create vhost
  await new Promise<void>((resolve, reject) => {
    const req = http.request(
      {
        host,
        port,
        method: 'PUT',
        path: `/api/vhosts/${encodeURIComponent(vhost)}`,
        headers: {
          Authorization: `Basic ${auth}`,
        },
      },
      (res) => {
        if (
          // pass a getter so side-effecting getters behave like the original
          // inline expression which accessed `res.statusCode` multiple times
          isStatusOkFromGetter(
            () => (res as unknown as { statusCode?: unknown }).statusCode
          )
        )
          resolve();
        else
          reject(
            new Error(
              `Failed to create vhost: HTTP ${(res as unknown as { statusCode?: unknown }).statusCode}`
            )
          );
      }
    );
    req.on('error', reject);
    req.end();
  });

  // Set permissions for the user on that vhost
  await new Promise<void>((resolve, reject) => {
    const body = JSON.stringify({ configure: '.*', write: '.*', read: '.*' });
    const req = http.request(
      {
        host,
        port,
        method: 'PUT',
        path: `/api/permissions/${encodeURIComponent(vhost)}/${encodeURIComponent(username)}`,
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        if (
          isStatusOkFromGetter(
            () => (res as unknown as { statusCode?: unknown }).statusCode
          )
        )
          resolve();
        else
          reject(
            new Error(
              `Failed to set permissions: HTTP ${(res as unknown as { statusCode?: unknown }).statusCode}`
            )
          );
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

export async function createRabbitMQService(
  opts: ICreateRabbitMQOpts
): Promise<IRabbitMQService> {
  const {
    id,
    createService,
    amqpPort,
    mgmtPort,
    env = process.env,
    waitToCloses = [],
  } = opts;

  const service = await createService(
    `rabbitmq-${id}`,
    amqpPort ?? env['RABBITMQ_AMQP_PORT']
  );
  const mgmtService = await createService(
    `rabbitmq-management-${id}`,
    mgmtPort ?? env['RABBITMQ_MANAGEMENT_PORT']
  );

  const vhost = `test_${id}`;

  const mgmtSvc = mgmtService as unknown as Record<string, unknown>;
  await ensureRabbitMqVhost(
    String(mgmtSvc.host ?? ''),
    Number(mgmtPort ?? env['RABBITMQ_MANAGEMENT_PORT']),
    vhost,
    env['RABBITMQ_USERNAME'] as string,
    env['RABBITMQ_PASSWORD'] as string
  );

  const svc = service as unknown as Record<string, unknown>;
  const connectionString = `amqp://${env['RABBITMQ_USERNAME']}:${env['RABBITMQ_PASSWORD']}@${String(
    svc.host ?? ''
  )}:${String(svc.port ?? '')}/${encodeURIComponent(vhost)}`;

  let connection: amqp.ChannelModel;
  let channel: amqp.Channel;
  try {
    connection = await amqp.connect(connectionString);
    channel = await connection.createChannel();
  } catch (error) {
    throw new Error(`Failed to connect to RabbitMQ: ${error}`);
  }

  waitToCloses.push(async (): Promise<void> => {
    try {
      await channel.close();
    } catch {
      // ignore
    }
    try {
      await connection.close();
    } catch {
      // ignore
    }
  });

  return {
    connection,
    channel,
    vhost,
    ...(service as unknown as object),
  } as IRabbitMQService;
}
