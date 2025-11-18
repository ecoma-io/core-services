import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SnapshotEntity } from './snapshot.entity';
import type { Snapshot } from '@ecoma-io/domain';

/**
 * SnapshotRepository (Phase 4.2)
 *
 * Manages aggregate state snapshots to reduce event replay overhead.
 * Snapshots are created based on a configurable policy (e.g., every N events).
 */
@Injectable()
export class SnapshotRepository {
  private readonly logger = new Logger(SnapshotRepository.name);

  constructor(
    @InjectRepository(SnapshotEntity)
    private readonly repository: Repository<SnapshotEntity>
  ) {}

  /**
   * Load the latest snapshot for an aggregate
   *
   * @param aggregateId - Aggregate identifier
   * @returns Snapshot or null if not found
   */
  async loadSnapshot(aggregateId: string): Promise<Snapshot | null> {
    const entity = await this.repository.findOne({
      where: { aggregateId },
    });

    if (!entity) {
      return null;
    }

    return {
      aggregateId: entity.aggregateId,
      lastEventPosition: entity.version,
      snapshotVersion: '1.0.0',
      createdAt: entity.createdAt.toISOString(),
      payload: entity.state,
    };
  }

  /**
   * Save a snapshot for an aggregate
   *
   * @param snapshot - Snapshot to persist
   */
  async saveSnapshot(snapshot: Snapshot, aggregateType: string): Promise<void> {
    const entity = new SnapshotEntity();
    entity.aggregateId = snapshot.aggregateId;
    entity.aggregateType = aggregateType;
    entity.version = snapshot.lastEventPosition;
    entity.state = snapshot.payload as Record<string, unknown>;

    await this.repository.save(entity);

    this.logger.log(
      `Saved snapshot for ${aggregateType}-${snapshot.aggregateId} at position ${snapshot.lastEventPosition}`
    );
  }

  /**
   * Delete snapshot for an aggregate (for testing or cleanup)
   *
   * @param aggregateId - Aggregate identifier
   */
  async deleteSnapshot(aggregateId: string): Promise<void> {
    await this.repository.delete({ aggregateId });
  }

  /**
   * Count total snapshots (for monitoring)
   *
   * @returns Number of snapshots
   */
  async countSnapshots(): Promise<number> {
    return this.repository.count();
  }

  /**
   * Delete old snapshots (for cleanup)
   *
   * @param olderThan - Delete snapshots updated before this date
   * @returns Number of deleted snapshots
   */
  async deleteOldSnapshots(olderThan: Date): Promise<number> {
    const result = await this.repository
      .createQueryBuilder()
      .delete()
      .from(SnapshotEntity)
      .where('updated_at < :olderThan', { olderThan })
      .execute();

    return result.affected ?? 0;
  }
}
