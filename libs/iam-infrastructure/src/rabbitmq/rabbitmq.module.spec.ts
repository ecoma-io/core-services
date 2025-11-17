import { RabbitMQInfraModule } from './rabbitmq.module';
import { RabbitMQEventPublisher } from '../event-publisher/rabbitmq-event.publisher';

describe('RabbitMQInfraModule', () => {
  it('should be defined', () => {
    expect(RabbitMQInfraModule).toBeDefined();
  });

  describe('forRoot', () => {
    it('should create module with providers', async () => {
      const module = RabbitMQInfraModule.forRoot({
        uri: 'amqp://localhost:5672',
        exchange: 'test.exchange',
        exchangeType: 'topic',
      });

      expect(module.module).toBe(RabbitMQInfraModule);
      expect(module.providers).toBeDefined();
      expect(module.exports).toContain(RabbitMQEventPublisher);
    });
  });

  describe('forRootAsync', () => {
    it('should create module with async configuration', async () => {
      const module = RabbitMQInfraModule.forRootAsync({
        useFactory: () => ({
          uri: 'amqp://localhost:5672',
          exchange: 'test.exchange',
          exchangeType: 'topic',
        }),
      });

      expect(module.module).toBe(RabbitMQInfraModule);
      expect(module.providers).toBeDefined();
      expect(module.exports).toContain(RabbitMQEventPublisher);
    });
  });
});
