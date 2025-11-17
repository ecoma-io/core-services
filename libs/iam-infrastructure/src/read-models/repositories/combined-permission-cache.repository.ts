import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CombinedPermissionCacheEntity } from '../entities/combined-permission-cache.entity';
import { PermissionNode } from '../../permissions/types';

/**
 * Repository for combined_permissions_cache table
 * Manages merged permission trees
 */
@Injectable()
export class CombinedPermissionCacheRepository {
  constructor(
    @InjectRepository(CombinedPermissionCacheEntity)
    private readonly repository: Repository<CombinedPermissionCacheEntity>
  ) {}

  /**
   * Find cached merged tree by service name
   *
   * @param serviceName - Service identifier
   * @returns Cached entity or null if not found
   */
  async findByServiceName(
    serviceName: string
  ): Promise<CombinedPermissionCacheEntity | null> {
    return this.repository.findOne({
      where: { serviceName },
    });
  }

  /**
   * Save or update merged permission tree for a service
   *
   * @param serviceName - Service identifier
   * @param combinedTree - Merged permission tree
   * @param mergedVersions - Versions that were merged
   * @param resolutionMetadata - Audit trail of conflict resolutions
   * @returns Saved entity
   */
  async upsert(
    serviceName: string,
    combinedTree: PermissionNode[],
    mergedVersions: Array<{
      version: string;
      priority: number;
      major: number;
    }>,
    resolutionMetadata?: Record<string, { version: string; reason: string }>
  ): Promise<CombinedPermissionCacheEntity> {
    const existing = await this.findByServiceName(serviceName);

    if (existing) {
      // Update existing
      existing.combinedTree = combinedTree;
      existing.mergedVersions = mergedVersions;
      existing.resolutionMetadata = resolutionMetadata;
      return this.repository.save(existing);
    } else {
      // Create new
      const entity = this.repository.create({
        serviceName,
        combinedTree,
        mergedVersions,
        resolutionMetadata,
      });
      return this.repository.save(entity);
    }
  }

  /**
   * Get all cached permission trees
   * Useful for rebuilding Redis cache
   *
   * @returns Array of all cached entities
   */
  async findAll(): Promise<CombinedPermissionCacheEntity[]> {
    return this.repository.find({
      order: { updatedAt: 'DESC' },
    });
  }

  /**
   * Delete cache entry for a service
   * Used when service is deregistered
   *
   * @param serviceName - Service identifier
   * @returns Number of deleted rows
   */
  async delete(serviceName: string): Promise<number> {
    const result = await this.repository.delete({ serviceName });
    return result.affected ?? 0;
  }

  /**
   * Clear all cache entries
   * Used for testing or full rebuild
   */
  async clear(): Promise<void> {
    await this.repository.clear();
  }
}
