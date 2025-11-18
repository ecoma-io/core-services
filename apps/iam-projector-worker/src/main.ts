import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  // Modules initialize + projector started via OnModuleInit provider
  await app.init();
  Logger.log('IAM Projector Worker initialized', 'Bootstrap');

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
