import { RabbitMQEventPublisher } from './rabbitmq-event.publisher';
import { DomainEventEnvelope } from '@ecoma-io/domain';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';

describe('RabbitMQEventPublisher', () => {
  let publisher: RabbitMQEventPublisher;
  let mockAmqpConnection: jest.Mocked<AmqpConnection>;

  beforeEach(() => {
    mockAmqpConnection = {
      publish: jest.fn().mockResolvedValue(undefined),
    } as any;

    publisher = new RabbitMQEventPublisher(mockAmqpConnection, {
      exchange: 'iam.events',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('publish', () => {
    it('should publish events to exchange with correct routing key', async () => {
      const events: DomainEventEnvelope[] = [
        {
          id: 'evt-1',
          type: 'UserRegistered',
          aggregateId: 'user-123',
          occurredAt: new Date().toISOString(),
          eventVersion: '1.0.0',
          payload: { email: 'test@example.com' },
          metadata: {},
        },
      ];

      await publisher.publish(events);

      expect(mockAmqpConnection.publish).toHaveBeenCalledWith(
        'iam.events',
        'iam.events.UserRegistered',
        events[0],
        expect.objectContaining({
          persistent: true,
          contentType: 'application/json',
          type: 'UserRegistered',
        })
      );
    });

    it('should publish multiple events', async () => {
      const events: DomainEventEnvelope[] = [
        {
          id: 'evt-1',
          type: 'UserRegistered',
          aggregateId: 'user-123',
          occurredAt: new Date().toISOString(),
          eventVersion: '1.0.0',
          payload: {},
          metadata: {},
        },
        {
          id: 'evt-2',
          type: 'TenantCreated',
          aggregateId: 'tenant-456',
          occurredAt: new Date().toISOString(),
          eventVersion: '1.0.0',
          payload: {},
          metadata: {},
        },
      ];

      await publisher.publish(events);

      expect(mockAmqpConnection.publish).toHaveBeenCalledTimes(2);
      expect(mockAmqpConnection.publish).toHaveBeenNthCalledWith(
        1,
        'iam.events',
        'iam.events.UserRegistered',
        events[0],
        expect.any(Object)
      );
      expect(mockAmqpConnection.publish).toHaveBeenNthCalledWith(
        2,
        'iam.events',
        'iam.events.TenantCreated',
        events[1],
        expect.any(Object)
      );
    });

    it('should throw error if publish fails', async () => {
      const error = new Error('Publish failed');
      mockAmqpConnection.publish.mockRejectedValue(error);

      const events: DomainEventEnvelope[] = [
        {
          id: 'evt-1',
          type: 'UserRegistered',
          aggregateId: 'user-123',
          occurredAt: new Date().toISOString(),
          eventVersion: '1.0.0',
          payload: {},
          metadata: {},
        },
      ];

      await expect(publisher.publish(events)).rejects.toThrow('Publish failed');
    });
  });
});
