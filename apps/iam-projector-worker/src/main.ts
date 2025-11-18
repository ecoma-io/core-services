import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  // Modules initialize + projector started via OnModuleInit provider
  await app.init();
  Logger.log('IAM Projector Worker initialized');
}

bootstrap();
