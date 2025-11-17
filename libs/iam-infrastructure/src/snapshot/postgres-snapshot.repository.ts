import { DataSource, Repository } from 'typeorm';
import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ISnapshotRepository, AggregateSnapshot } from './snapshot.service';

/**
 * TypeORM entity for aggregate snapshots.
 */
@Entity('aggregate_snapshots')
@Index(['aggregateId', 'version'])
export class SnapshotEntity {
  @PrimaryColumn({ name: 'aggregate_id', type: 'varchar', length: 255 })
  aggregateId!: string;

  @Column({ name: 'aggregate_type', type: 'varchar', length: 100 })
  aggregateType!: string;

  @Column({ type: 'int' })
  version!: number;

  @Column({ type: 'jsonb' })
  state!: unknown;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;
}

/**
 * PostgreSQL implementation of snapshot repository using TypeORM.
 *
 * @see ADR-6: Snapshot Policy - Store K=3 latest snapshots
 */
export class PostgresSnapshotRepository implements ISnapshotRepository {
  private repository: Repository<SnapshotEntity>;

  constructor(private readonly dataSource: DataSource) {
    this.repository = dataSource.getRepository(SnapshotEntity);
  }

  async saveSnapshot<TState>(
    snapshot: AggregateSnapshot<TState>
  ): Promise<void> {
    const entity = this.repository.create({
      aggregateId: snapshot.aggregateId,
      aggregateType: snapshot.aggregateType,
      version: snapshot.version,
      state: snapshot.state,
      createdAt: snapshot.createdAt,
    });

    await this.repository.save(entity);
  }

  async loadSnapshot<TState>(
    aggregateId: string
  ): Promise<AggregateSnapshot<TState> | null> {
    const entity = await this.repository.findOne({
      where: { aggregateId },
      order: { version: 'DESC' },
    });

    if (!entity) {
      return null;
    }

    return {
      aggregateId: entity.aggregateId,
      aggregateType: entity.aggregateType,
      version: entity.version,
      state: entity.state as TState,
      createdAt: entity.createdAt,
    };
  }

  async cleanupSnapshots(aggregateId: string, keepCount = 3): Promise<void> {
    // Get all snapshots ordered by version descending
    const snapshots = await this.repository.find({
      where: { aggregateId },
      order: { version: 'DESC' },
    });

    // Keep only the latest K snapshots
    if (snapshots.length <= keepCount) {
      return;
    }

    const toDelete = snapshots.slice(keepCount);
    const versionsToDelete = toDelete.map((s) => s.version);

    await this.repository
      .createQueryBuilder()
      .delete()
      .from(SnapshotEntity)
      .where('aggregate_id = :aggregateId', { aggregateId })
      .andWhere('version IN (:...versions)', { versions: versionsToDelete })
      .execute();
  }
}
