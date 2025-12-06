// eslint-disable-next-line @nx/enforce-module-boundaries
import {
  StandardizedLogger,
  StandardizedTracer,
} from '@ecoma-io/node-observability';
import { Options } from 'pino-opentelemetry-transport';

export interface IInitLoggerOpts {
  id: string;
  projectName: string;
  projectVersion: string;
}

export function initStandardizedLogger(opts: IInitLoggerOpts) {
  const { id, projectName, projectVersion } = opts;
  StandardizedLogger.initialize({
    level: 'trace',
    extra: { testEnvironmentId: id },
    transport: {
      target: 'pino-opentelemetry-transport',
      level: 'trace',
      options: {
        resourceAttributes: {
          'service.name': projectName,
          'service.version': projectVersion,
        },
        logRecordProcessorOptions: {
          recordProcessorType: 'simple',
          exporterOptions: {
            protocol: 'http',
            httpExporterOptions: {
              url: `http://127.0.0.1:${process.env.HYPERDX_OLTP_HTTP_PORT}/v1/logs`,
              headers: {
                Authorization: process.env.HYPERDX_API_KEY,
              } as Record<string, string>,
            },
          },
        },
      } as Options,
    },
  });
}

export interface IInitTracerOpts {
  id: string;
  projectName: string;
  projectVersion: string;
}

export function initStandardizedTracer(opts: IInitTracerOpts) {
  const { id, projectName, projectVersion } = opts;
  const otelEndpoint = `grpc://${'172.168.186.168'}:${process.env.HYPERDX_OLTP_GRPC_PORT}`;
  const otelHeaders = `Authorization:${process.env.HYPERDX_API_KEY}`;

  StandardizedTracer.initialize(
    {
      serviceName: projectName,
      serviceVersion: projectVersion,
      environment: 'test',
      otlpEndpoint: otelEndpoint,
      metrics: { enabled: false, metricsPort: 0 },
      otlpHeaders: otelHeaders.split(',').reduce(
        (acc, header) => {
          const [key, value] = header.split(':');
          acc[key] = value;
          return acc;
        },
        {} as Record<string, string>
      ),
      batchProcessMaxQueueSize: 1,
      loggingExtra: { testEnvironmentId: id },
    },
    []
  );
}
