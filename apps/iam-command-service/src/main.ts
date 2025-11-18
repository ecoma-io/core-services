import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { GlobalExceptionsFilter } from '@ecoma-io/nestjs-filters';
import { GlobalValidationPipe } from '@ecoma-io/nestjs-pipes';
import { AppConfigService } from './app/app.config-service';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const configService = new AppConfigService();
  const appConfig = configService.getAppConfig();

  const app = await NestFactory.create(AppModule);

  // Apply global exception filter as per repo conventions
  app.useGlobalFilters(new GlobalExceptionsFilter(app.get(HttpAdapterHost)));
  app.useGlobalPipes(new GlobalValidationPipe());

  await app.listen(appConfig.port, appConfig.host, () => {
    Logger.log(
      `IAM Command Service (${appConfig.nodeEnv}) running on: ${appConfig.host}:${appConfig.port}/`,
      'Bootstrap'
    );
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    Logger.log(`Received ${signal}, shutting down gracefully...`, 'Bootstrap');
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap();
