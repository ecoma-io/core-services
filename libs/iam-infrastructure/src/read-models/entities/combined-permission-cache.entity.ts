import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PermissionNode } from '../../permissions/types';

/**
 * Entity for combined_permissions_cache table
 * Stores merged permission trees from 3 latest major versions per service
 *
 * @see ADR-5 in docs/iam/architecture.md
 */
@Entity('combined_permissions_cache')
export class CombinedPermissionCacheEntity {
  /**
   * Service name (primary key)
   * Example: 'billing-service', 'resource-service'
   */
  @PrimaryColumn({ type: 'varchar', length: 255, name: 'service_name' })
  serviceName!: string;

  /**
   * Merged permission tree (JSONB)
   * Array of PermissionNode with nested children
   */
  @Column({ type: 'jsonb', name: 'combined_tree' })
  combinedTree!: PermissionNode[];

  /**
   * Metadata about merged versions
   * Array of { version, priority, major }
   */
  @Column({ type: 'jsonb', name: 'merged_versions' })
  mergedVersions!: Array<{
    version: string;
    priority: number;
    major: number;
  }>;

  /**
   * Audit trail: which version won at each path conflict
   * Map of path -> { version, reason }
   */
  @Column({
    type: 'jsonb',
    name: 'resolution_metadata',
    nullable: true,
  })
  resolutionMetadata?: Record<string, { version: string; reason: string }>;

  /**
   * When this cache entry was created
   */
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  /**
   * When this cache entry was last updated
   * Auto-updated by trigger
   */
  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
