import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * ServiceDefinition Read Model Entity (Permission Registry).
 *
 * @see ADR-5: Permission Merge Rules
 */
@Entity('service_definitions_read_model')
@Index(['name'])
export class ServiceDefinitionEntity {
  @PrimaryColumn({ name: 'service_id', type: 'uuid' })
  serviceId!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'jsonb', default: '[]' })
  versions!: Array<{
    version: string;
    permissionsTree: unknown;
    publishedAt: string;
  }>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;
}
