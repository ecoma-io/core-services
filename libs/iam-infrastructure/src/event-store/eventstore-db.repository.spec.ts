import { EventStoreDbRepository } from './eventstore-db.repository';
import { EventStoreDBClient } from '@eventstore/db-client';
import { DomainEventEnvelope } from '@ecoma-io/domain';

describe('EventStoreDbRepository', () => {
  let repository: EventStoreDbRepository;
  let mockClient: jest.Mocked<EventStoreDBClient>;

  beforeEach(() => {
    mockClient = {
      appendToStream: jest.fn(),
      readStream: jest.fn(),
    } as any;

    repository = new EventStoreDbRepository(mockClient);
  });

  describe('saveEvents', () => {
    it('should append events to stream with expected version', async () => {
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

      mockClient.appendToStream.mockResolvedValue({} as any);

      await repository.saveEvents('user-123', events, 0);

      expect(mockClient.appendToStream).toHaveBeenCalledWith(
        'user-123',
        expect.arrayContaining([
          expect.objectContaining({
            type: 'UserRegistered',
          }),
        ]),
        expect.objectContaining({
          expectedRevision: BigInt(0),
        })
      );
    });
  });

  describe('loadEvents', () => {
    it('should return empty array when stream not found', async () => {
      const error = new Error('Stream not found');
      (error as any).type = 'stream-not-found';

      mockClient.readStream.mockImplementation(() => {
        throw error;
      });

      const events = await repository.loadEvents('user-999');

      expect(events).toEqual([]);
    });
  });
});
