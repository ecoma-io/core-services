import { Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

/**
 * Permission Cache Repository using Redis.
 *
 * Caches:
 * - User permissions per tenant: "user_perms:{userId}:{tenantId}"
 * - Combined permissions tree: "permissions:combined-tree"
 * - Projection checkpoints for RYOW: "projection:{projectorName}:checkpoint"
 *
 * @see ADR-3: Read-Your-Own-Writes Mechanism
 */
@Injectable()
export class PermissionCacheRepository {
  private readonly logger = new Logger(PermissionCacheRepository.name);
  private readonly TTL_SECONDS = 3600; // 1 hour

  constructor(private readonly redis: Redis) {}

  /**
   * Get cached user permissions for a specific tenant.
   */
  async getUserPermissions(
    userId: string,
    tenantId: string
  ): Promise<string[] | null> {
    const key = `user_perms:${userId}:${tenantId}`;
    const cached = await this.redis.get(key);
    if (!cached) {
      return null;
    }
    try {
      return JSON.parse(cached) as string[];
    } catch {
      this.logger.warn(`Failed to parse cached permissions for ${key}`);
      return null;
    }
  }

  /**
   * Set user permissions cache for a specific tenant.
   */
  async setUserPermissions(
    userId: string,
    tenantId: string,
    permissions: string[]
  ): Promise<void> {
    const key = `user_perms:${userId}:${tenantId}`;
    await this.redis.setex(key, this.TTL_SECONDS, JSON.stringify(permissions));
  }

  /**
   * Invalidate user permissions cache.
   */
  async invalidateUserPermissions(
    userId: string,
    tenantId: string
  ): Promise<void> {
    const key = `user_perms:${userId}:${tenantId}`;
    await this.redis.del(key);
  }

  /**
   * Get combined permissions tree (merged from all services).
   */
  async getCombinedPermissionsTree(): Promise<unknown | null> {
    const key = 'permissions:combined-tree';
    const cached = await this.redis.get(key);
    if (!cached) {
      return null;
    }
    try {
      return JSON.parse(cached);
    } catch {
      this.logger.warn('Failed to parse combined permissions tree');
      return null;
    }
  }

  /**
   * Set combined permissions tree cache.
   */
  async setCombinedPermissionsTree(tree: unknown): Promise<void> {
    const key = 'permissions:combined-tree';
    await this.redis.setex(key, this.TTL_SECONDS, JSON.stringify(tree));
  }

  /**
   * Invalidate combined permissions tree.
   */
  async invalidateCombinedPermissionsTree(): Promise<void> {
    const key = 'permissions:combined-tree';
    await this.redis.del(key);
  }

  /**
   * Get projection checkpoint for RYOW mechanism.
   *
   * @see ADR-3: RYOW - clients poll checkpoint
   */
  async getProjectionCheckpoint(projectorName: string): Promise<bigint | null> {
    const key = `projection:${projectorName}:checkpoint`;
    const cached = await this.redis.get(key);
    if (!cached) {
      return null;
    }
    try {
      return BigInt(cached);
    } catch {
      this.logger.warn(`Invalid checkpoint format for ${projectorName}`);
      return null;
    }
  }

  /**
   * Set projection checkpoint (updated by projectors after commit).
   */
  async setProjectionCheckpoint(
    projectorName: string,
    position: bigint
  ): Promise<void> {
    const key = `projection:${projectorName}:checkpoint`;
    await this.redis.set(key, position.toString());
  }

  /**
   * Wait for projection to reach a specific position (RYOW polling).
   *
   * @returns true if reached within timeout, false otherwise
   */
  async waitForProjection(
    projectorName: string,
    targetPosition: bigint,
    timeoutMs = 5000
  ): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      const current = await this.getProjectionCheckpoint(projectorName);
      if (current !== null && current >= targetPosition) {
        return true;
      }
      await this.sleep(100);
    }
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
