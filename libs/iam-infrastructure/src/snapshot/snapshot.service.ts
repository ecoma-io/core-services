import { AggregateRoot } from '@ecoma-io/domain';

/**
 * Snapshot represents a point-in-time state of an aggregate.
 *
 * @see ADR-6: Snapshot Policy for Aggregates
 */
export interface AggregateSnapshot<TState = unknown> {
  aggregateId: string;
  aggregateType: string;
  version: number;
  state: TState;
  createdAt: Date;
}

/**
 * Repository for storing and retrieving aggregate snapshots.
 */
export interface ISnapshotRepository {
  /**
   * Save a snapshot for an aggregate.
   *
   * @param snapshot - The snapshot to save
   */
  saveSnapshot<TState>(snapshot: AggregateSnapshot<TState>): Promise<void>;

  /**
   * Load the latest snapshot for an aggregate.
   *
   * @param aggregateId - The aggregate identifier
   * @returns The latest snapshot or null if none exists
   */
  loadSnapshot<TState>(
    aggregateId: string
  ): Promise<AggregateSnapshot<TState> | null>;

  /**
   * Delete old snapshots, keeping only K latest snapshots.
   *
   * @param aggregateId - The aggregate identifier
   * @param keepCount - Number of latest snapshots to keep (default: 3)
   */
  cleanupSnapshots(aggregateId: string, keepCount?: number): Promise<void>;
}

/**
 * Policy for determining when to create snapshots.
 *
 * @see ADR-6: Snapshot Policy for Aggregates
 */
export interface SnapshotPolicy {
  /**
   * Determine if a snapshot should be created based on aggregate state.
   *
   * @param aggregate - The aggregate root
   * @param eventsSinceLastSnapshot - Number of events since last snapshot
   * @param timeSinceLastSnapshot - Milliseconds since last snapshot
   * @returns True if snapshot should be created
   */
  shouldCreateSnapshot(
    aggregate: AggregateRoot<unknown>,
    eventsSinceLastSnapshot: number,
    timeSinceLastSnapshot: number
  ): boolean;
}

/**
 * Default hybrid snapshot policy: create snapshot after N events OR T time.
 *
 * @see ADR-6: Snapshot after N=100 events OR T=24h
 */
export class HybridSnapshotPolicy implements SnapshotPolicy {
  constructor(
    private readonly eventThreshold = 100,
    private readonly timeThresholdMs = 24 * 60 * 60 * 1000 // 24 hours
  ) {}

  shouldCreateSnapshot(
    _aggregate: AggregateRoot<unknown>,
    eventsSinceLastSnapshot: number,
    timeSinceLastSnapshot: number
  ): boolean {
    return (
      eventsSinceLastSnapshot >= this.eventThreshold ||
      timeSinceLastSnapshot >= this.timeThresholdMs
    );
  }
}

/**
 * Service for managing aggregate snapshots.
 */
export class SnapshotService {
  constructor(
    private readonly repository: ISnapshotRepository,
    private readonly policy: SnapshotPolicy
  ) {}

  /**
   * Create a snapshot if policy conditions are met.
   *
   * @param aggregate - The aggregate to snapshot
   * @param aggregateType - Type identifier for the aggregate
   * @param lastSnapshotTime - Timestamp of last snapshot (optional)
   */
  async createSnapshotIfNeeded<TState>(
    aggregate: AggregateRoot<TState>,
    aggregateType: string,
    lastSnapshotTime?: Date
  ): Promise<boolean> {
    const eventsSinceLastSnapshot = aggregate.version;
    const timeSinceLastSnapshot = lastSnapshotTime
      ? Date.now() - lastSnapshotTime.getTime()
      : Number.MAX_SAFE_INTEGER;

    if (
      !this.policy.shouldCreateSnapshot(
        aggregate,
        eventsSinceLastSnapshot,
        timeSinceLastSnapshot
      )
    ) {
      return false;
    }

    await this.createSnapshot(aggregate, aggregateType);
    return true;
  }

  /**
   * Force create a snapshot for an aggregate.
   *
   * @param aggregate - The aggregate to snapshot
   * @param aggregateType - Type identifier for the aggregate
   */
  async createSnapshot<TState>(
    aggregate: AggregateRoot<TState>,
    aggregateType: string
  ): Promise<void> {
    const snapshot: AggregateSnapshot<TState> = {
      aggregateId: this.getAggregateId(aggregate),
      aggregateType,
      version: aggregate.version,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      state: (aggregate as any)._state as TState,
      createdAt: new Date(),
    };

    await this.repository.saveSnapshot(snapshot);

    // Cleanup old snapshots, keeping K=3 latest
    await this.repository.cleanupSnapshots(snapshot.aggregateId, 3);
  }

  /**
   * Load a snapshot for an aggregate.
   *
   * @param aggregateId - The aggregate identifier
   */
  async loadSnapshot<TState>(
    aggregateId: string
  ): Promise<AggregateSnapshot<TState> | null> {
    return this.repository.loadSnapshot<TState>(aggregateId);
  }

  /**
   * Extract aggregate ID from aggregate state.
   */
  private getAggregateId(aggregate: AggregateRoot<unknown>): string {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state = (aggregate as any)._state as Record<string, unknown>;
    // Try common ID fields
    const id =
      (state['userId'] as string) ||
      (state['tenantId'] as string) ||
      (state['roleId'] as string) ||
      (state['membershipId'] as string) ||
      (state['id'] as string);

    if (!id) {
      throw new Error('Cannot determine aggregate ID from state');
    }

    return id;
  }
}
