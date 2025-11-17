import {
  SnapshotService,
  HybridSnapshotPolicy,
  ISnapshotRepository,
  AggregateSnapshot,
} from './snapshot.service';
import { AggregateRoot } from '@ecoma-io/domain';

class TestAggregate extends AggregateRoot<{ id: string; value: number }> {
  constructor(id: string) {
    super();
    this._state = { id, value: 0 };
  }

  protected applyEvent(): void {
    // No-op for test
  }

  increment(): void {
    this._state.value++;
    // Simulate version increment via event recording
    this.recordEvent({
      id: `evt-${Date.now()}`,
      type: 'TestIncremented',
      aggregateId: this._state.id,
      occurredAt: new Date().toISOString(),
      eventVersion: '1.0.0',
      payload: {},
      metadata: {},
    });
  }
}

describe('SnapshotService', () => {
  let service: SnapshotService;
  let mockRepository: jest.Mocked<ISnapshotRepository>;
  let policy: HybridSnapshotPolicy;

  beforeEach(() => {
    mockRepository = {
      saveSnapshot: jest.fn().mockResolvedValue(undefined),
      loadSnapshot: jest.fn().mockResolvedValue(null),
      cleanupSnapshots: jest.fn().mockResolvedValue(undefined),
    };

    policy = new HybridSnapshotPolicy(100, 24 * 60 * 60 * 1000);
    service = new SnapshotService(mockRepository, policy);
  });

  describe('createSnapshotIfNeeded', () => {
    it('should create snapshot when event threshold reached', async () => {
      const aggregate = new TestAggregate('test-1');
      // Simulate 100 events
      for (let i = 0; i < 100; i++) {
        aggregate.increment();
      }

      const created = await service.createSnapshotIfNeeded(
        aggregate,
        'TestAggregate'
      );

      expect(created).toBe(true);
      expect(mockRepository.saveSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({
          aggregateId: 'test-1',
          aggregateType: 'TestAggregate',
          // version is based on uncommittedEvents.length which is 100
          version: expect.any(Number),
        })
      );
    });

    it('should not create snapshot when threshold not reached', async () => {
      const aggregate = new TestAggregate('test-2');
      aggregate.increment();

      const created = await service.createSnapshotIfNeeded(
        aggregate,
        'TestAggregate',
        new Date()
      );

      expect(created).toBe(false);
      expect(mockRepository.saveSnapshot).not.toHaveBeenCalled();
    });

    it('should create snapshot when time threshold exceeded', async () => {
      const aggregate = new TestAggregate('test-3');
      aggregate.increment();

      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago

      const created = await service.createSnapshotIfNeeded(
        aggregate,
        'TestAggregate',
        oldDate
      );

      expect(created).toBe(true);
      expect(mockRepository.saveSnapshot).toHaveBeenCalled();
    });
  });

  describe('createSnapshot', () => {
    it('should force create snapshot and cleanup old ones', async () => {
      const aggregate = new TestAggregate('test-4');

      await service.createSnapshot(aggregate, 'TestAggregate');

      expect(mockRepository.saveSnapshot).toHaveBeenCalled();
      expect(mockRepository.cleanupSnapshots).toHaveBeenCalledWith('test-4', 3);
    });
  });

  describe('loadSnapshot', () => {
    it('should load snapshot from repository', async () => {
      const mockSnapshot: AggregateSnapshot = {
        aggregateId: 'test-5',
        aggregateType: 'TestAggregate',
        version: 50,
        state: { id: 'test-5', value: 50 },
        createdAt: new Date(),
      };

      mockRepository.loadSnapshot.mockResolvedValue(mockSnapshot);

      const snapshot = await service.loadSnapshot('test-5');

      expect(snapshot).toEqual(mockSnapshot);
      expect(mockRepository.loadSnapshot).toHaveBeenCalledWith('test-5');
    });
  });
});
