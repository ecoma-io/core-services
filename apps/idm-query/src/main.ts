import {
  GlobalExceptionsFilter,
  GlobalValidationPipe,
  NestStandardizedLogger,
  NestStandardizedTracer,
} from '@ecoma-io/nestjs-common';
import { AppConfigService } from './app.config';
import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { useContainer } from 'class-validator';
import { AppModule } from './app.module';
import { sleep } from '@ecoma-io/common';

(async () => {
  // Load package version and app config
  const version = require('package.json').version;
  const config = new AppConfigService();
  const redactKeys = [
    'password',
    'accessToken',
    'refreshToken',
    'email',
    'phone',
  ];

  // Initialize Logger
  const logLevel = config.appEnvName === 'production' ? 'info' : 'trace';
  NestStandardizedLogger.initialize({
    level: logLevel,
    redactKeys: redactKeys,
  });

  // Initialize Tracer
  NestStandardizedTracer.initialize(
    {
      ...config.otelTracerConfig,
      serviceName: 'idm-query',
      serviceVersion: version,
      redactedQueryParams: redactKeys,
    },
    []
  );

  const logger = new NestStandardizedLogger({ context: 'Bootstrap' });
  logger.info(
    `Starting idm-query v${version} with environment: ${config.appEnvName}`
  );

  const app = await NestFactory.create(AppModule, {
    logger: new NestStandardizedLogger({ context: 'NestJS' }),
  });
  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  app.enableShutdownHooks();
  app.useGlobalPipes(new GlobalValidationPipe());
  app.useGlobalFilters(new GlobalExceptionsFilter(app.get(HttpAdapterHost)));

  await app.listen(config.appPort, config.appHost, () => {
    logger.info(
      `idm-query v${version} is running on ${config.appHost}:${config.appPort}`
    );
  });

  process.on('unhandledRejection', (reason: unknown, promise) => {
    logger.error(
      `Unhandled Rejection at: ${promise}, reason: ${reason instanceof Error ? reason.stack : reason}`
    );
  });

  async function gracefulShutdown(exitCode: number) {
    try {
      await app.close();
      logger.info('Application shut down successfully.');
      await NestStandardizedTracer.shutdown();
      logger.info('Tracer shut down successfully.');
      await NestStandardizedLogger.shutdown();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`Error during shutdown: ${String(err)}`, err.stack);
    } finally {
      // Ensure logger transports (for example pino transports / pino-pretty)
      // have a short moment to flush any buffered output before exiting.
      // Calling `process.exit` immediately can terminate pending writes.
      await sleep(500);
      process.exit(exitCode);
    }
  }

  process.on('uncaughtException', async (error: Error) => {
    logger.fatal(`Uncaught Exception: ${error.stack || error.message}`);
    await gracefulShutdown(1);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down gracefully...');
    await gracefulShutdown(0);
  });

  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    await gracefulShutdown(0);
  });
})();
