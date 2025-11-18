/**
 * ProjectionCheckpoint TypeORM entity for tracking projector position.
 */
import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('projection_checkpoints')
@Index(['projectorName', 'streamId'], { unique: true })
export class ProjectionCheckpointEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ name: 'projector_name', type: 'varchar', length: 200 })
  projectorName!: string;

  @Column({ name: 'stream_id', type: 'varchar', length: 200 })
  streamId!: string;

  @Column({ name: 'position', type: 'bigint' })
  position!: number;

  @Column({
    name: 'updated_at',
    type: 'timestamp with time zone',
    default: () => 'now()',
  })
  updatedAt!: Date;
}
