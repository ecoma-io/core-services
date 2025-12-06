// eslint-disable-next-line @nx/enforce-module-boundaries
import { StandardizedLogger } from '@ecoma-io/node-observability';
import { InternalAxiosRequestConfig, AxiosHeaders } from 'axios';
import { context, propagation } from '@opentelemetry/api';
import { Tracer } from '@opentelemetry/api';

export function createAxiosInterceptor(
  tracer: Tracer,
  logger: StandardizedLogger
) {
  return (hostServiceName: string) => (config: InternalAxiosRequestConfig) => {
    return tracer.startActiveSpan(
      `${config.method?.toUpperCase() ?? 'GET'} ${hostServiceName}${config.url}`,
      (span) => {
        logger.info({
          msg: `Injecting tracing headers for ${config.method?.toUpperCase()} [${hostServiceName}]${config.url}`,
          traceId: span.spanContext().traceId,
        });
        try {
          config.headers = config.headers ?? ({} as AxiosHeaders);
          propagation.inject(context.active(), config.headers);
          return config;
        } finally {
          span.end();
        }
      }
    );
  };
}
