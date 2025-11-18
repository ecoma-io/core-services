import { Injectable } from '@nestjs/common';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { RabbitMqAdapter } from '@ecoma-io/iam-worker-infrastructure';

@Injectable()
export class EventConsumer {
  constructor(private readonly adapter: RabbitMqAdapter) {}

  // Subscribe to all IAM domain events published to the exchange
  @RabbitSubscribe({
    exchange: process.env.RABBITMQ_EXCHANGE || 'iam.events',
    routingKey: 'iam.events.*',
    queue: process.env.RABBITMQ_QUEUE || 'iam.projector.worker',
    queueOptions: { durable: true },
  })
  async handle(msg: unknown): Promise<void> {
    await this.adapter.handleMessage(msg);
  }
}
