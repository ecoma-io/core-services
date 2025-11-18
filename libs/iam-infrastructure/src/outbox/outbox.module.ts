import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { OutboxEvent } from './outbox-event.entity';
import { OutboxRepository } from './outbox.repository';
import { OutboxPublisher } from './outbox.publisher';

/**
 * OutboxModule
 *
 * Provides transactional outbox pattern for at-least-once event delivery.
 * Includes:
 * - OutboxEvent entity
 * - OutboxRepository for persistence
 * - OutboxPublisher for background publishing
 */
@Module({
  imports: [TypeOrmModule.forFeature([OutboxEvent]), ScheduleModule.forRoot()],
  providers: [OutboxRepository, OutboxPublisher],
  exports: [OutboxRepository],
})
export class OutboxModule {}
