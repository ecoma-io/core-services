import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app/app.module';
import { GlobalExceptionsFilter } from '@ecoma-io/nestjs-filters';
import { GlobalValidationPipe } from '@ecoma-io/nestjs-pipes';
import { AppConfigService } from './app/app.config-service';

async function bootstrap() {
  const configService = new AppConfigService();
  const appConfig = configService.getAppConfig();

  Logger.log(
    'Starting IAM Command Service with environment: ' + appConfig.nodeEnv
  );

  const app = await NestFactory.create(AppModule);

  // Apply global exception filter as per repo conventions
  app.useGlobalFilters(new GlobalExceptionsFilter(app.get(HttpAdapterHost)));
  app.useGlobalPipes(new GlobalValidationPipe());

  await app.listen(appConfig.port, appConfig.host, () => {
    Logger.log(
      `Resource service is running on: ${appConfig.host}:${appConfig.port}/`
    );
  });
}

bootstrap();
