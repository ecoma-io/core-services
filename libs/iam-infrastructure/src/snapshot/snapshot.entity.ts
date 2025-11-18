import {
  Column,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
  CreateDateColumn,
} from 'typeorm';

/**
 * SnapshotEntity (Phase 4.2)
 *
 * Stores aggregate state snapshots to optimize event replay.
 * Snapshots are taken periodically based on a policy (e.g., every 50 events).
 */
@Entity('snapshots')
@Index('idx_snapshots_aggregate_type', ['aggregateType'])
@Index('idx_snapshots_updated_at', ['updatedAt'])
export class SnapshotEntity {
  /**
   * Aggregate identifier (matches stream name)
   */
  @PrimaryColumn({ name: 'aggregate_id', type: 'varchar', length: 255 })
  aggregateId!: string;

  /**
   * Aggregate type (e.g., 'Tenant', 'User', 'Role')
   */
  @Column({ name: 'aggregate_type', type: 'varchar', length: 100 })
  aggregateType!: string;

  /**
   * Stream version at which this snapshot was taken
   */
  @Column({ type: 'int' })
  version!: number;

  /**
   * Serialized aggregate state (JSONB)
   */
  @Column({ type: 'jsonb' })
  state!: Record<string, unknown>;

  /**
   * When this snapshot was created
   */
  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp with time zone',
  })
  createdAt!: Date;

  /**
   * When this snapshot was last updated
   */
  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp with time zone',
  })
  updatedAt!: Date;
}
