import { Injectable, Logger } from '@nestjs/common';
import { PermissionMergeService } from './permission-merge.service';
import { PermissionCacheRepository } from '../cache/permission-cache.repository';
import { MembershipReadRepository } from '../read-models/repositories/membership-read.repository';
import { RoleReadRepository } from '../read-models/repositories/role-read.repository';
import { ExpandedPermissions, PermissionNode } from './types';

/**
 * Service for calculating and caching user permissions
 * Implements ADR-5 Stage 2: User Permission Expansion
 *
 * **Flow:**
 * 1. Load user's memberships (user-tenant associations)
 * 2. For each membership, load assigned roles
 * 3. Collect all permission keys from roles
 * 4. Load combined permission tree from Redis
 * 5. Expand each permission key to include nested children
 * 6. Cache expanded permissions to Redis
 *
 * @see docs/iam/architecture.md ADR-5
 */
@Injectable()
export class UserPermissionService {
  private readonly logger = new Logger(UserPermissionService.name);
  private readonly cacheTTL = 3600; // 1 hour in seconds

  constructor(
    private readonly mergeService: PermissionMergeService,
    private readonly cacheRepo: PermissionCacheRepository,
    private readonly membershipRepo: MembershipReadRepository,
    private readonly roleRepo: RoleReadRepository
  ) {}

  /**
   * Calculate and cache permissions for a user in a specific tenant
   *
   * @param userId - User ID
   * @param tenantId - Tenant ID
   * @returns Expanded permissions set
   */
  async calculateAndCacheUserPermissions(
    userId: string,
    tenantId: string
  ): Promise<ExpandedPermissions> {
    this.logger.log(
      `Calculating permissions for user ${userId} in tenant ${tenantId}`
    );

    try {
      // Step 1: Load user's membership in this tenant
      const membership = await this.membershipRepo.findByUserAndTenant(
        userId,
        tenantId
      );

      if (!membership) {
        this.logger.warn(
          `No membership found for user ${userId} in tenant ${tenantId}`
        );
        return this.createEmptyPermissions(userId, tenantId);
      }

      // Step 2: Load roles assigned to this membership
      const roleIds = membership.roleIds;
      if (!roleIds || roleIds.length === 0) {
        this.logger.debug(`User ${userId} has no roles in tenant ${tenantId}`);
        return this.createEmptyPermissions(userId, tenantId);
      }

      const roles = await this.roleRepo.findByIds(roleIds);

      // Step 3: Collect all permission keys from roles
      const permissionKeys = new Set<string>();
      for (const role of roles) {
        if (role.permissionKeys && role.permissionKeys.length > 0) {
          role.permissionKeys.forEach((key) => permissionKeys.add(key));
        }
      }

      if (permissionKeys.size === 0) {
        this.logger.debug(
          `User ${userId} has roles but no permissions in tenant ${tenantId}`
        );
        return this.createEmptyPermissions(userId, tenantId);
      }

      // Step 4: Load combined permission tree from Redis
      const combinedTree = (await this.cacheRepo.getCombinedTree()) as
        | PermissionNode[]
        | null;

      if (!combinedTree) {
        this.logger.warn(
          'No combined permission tree found in cache. Permissions may not be merged yet.'
        );
        return this.createEmptyPermissions(userId, tenantId);
      }

      // Step 5: Expand each permission key
      const expandedPermissions = new Set<string>();

      for (const permKey of permissionKeys) {
        const expanded = await this.mergeService.expandPermission(
          permKey,
          combinedTree as PermissionNode[]
        );
        expanded.forEach((p) => expandedPermissions.add(p));
      }

      this.logger.log(
        `Expanded ${permissionKeys.size} permission keys to ${expandedPermissions.size} permissions for user ${userId}`
      );

      // Step 6: Cache to Redis
      const result: ExpandedPermissions = {
        userId,
        tenantId,
        permissions: expandedPermissions,
        calculatedAt: new Date(),
        ttl: this.cacheTTL,
      };

      await this.cacheRepo.cacheUserPermissions(
        userId,
        tenantId,
        Array.from(expandedPermissions)
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to calculate permissions for user ${userId} in tenant ${tenantId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Invalidate cached permissions for a user in a tenant
   *
   * @param userId - User ID
   * @param tenantId - Tenant ID
   */
  async invalidateUserPermissions(
    userId: string,
    tenantId: string
  ): Promise<void> {
    this.logger.debug(
      `Invalidating permissions cache for user ${userId} in tenant ${tenantId}`
    );

    // Delete from Redis
    // Note: PermissionCacheRepository doesn't have delete method yet
    // We'll implement it or the cache will expire after TTL
    // TODO: Add deleteUserPermissions() to PermissionCacheRepository
  }

  /**
   * Invalidate permissions for all users who have a specific role
   *
   * @param roleId - Role ID
   */
  async invalidateUsersByRole(roleId: string): Promise<void> {
    this.logger.log(
      `Invalidating permissions for all users with role ${roleId}`
    );

    try {
      // Find all memberships with this role
      const memberships = await this.membershipRepo.findByRoleId(roleId);

      this.logger.debug(
        `Found ${memberships.length} memberships with role ${roleId}`
      );

      // Invalidate each user-tenant combination
      for (const membership of memberships) {
        await this.invalidateUserPermissions(
          membership.userId,
          membership.tenantId
        );
      }

      this.logger.log(
        `Invalidated permissions for ${memberships.length} users`
      );
    } catch (error) {
      this.logger.error(`Failed to invalidate users by role ${roleId}:`, error);
      throw error;
    }
  }

  /**
   * Recalculate permissions for all users who have a specific role
   * Called when role permissions change
   *
   * @param roleId - Role ID
   */
  async recalculateUsersByRole(roleId: string): Promise<void> {
    this.logger.log(
      `Recalculating permissions for all users with role ${roleId}`
    );

    try {
      const memberships = await this.membershipRepo.findByRoleId(roleId);

      this.logger.debug(`Recalculating for ${memberships.length} memberships`);

      // Recalculate each user-tenant combination
      const promises = memberships.map((membership) =>
        this.calculateAndCacheUserPermissions(
          membership.userId,
          membership.tenantId
        )
      );

      await Promise.all(promises);

      this.logger.log(
        `Recalculated permissions for ${memberships.length} users`
      );
    } catch (error) {
      this.logger.error(
        `Failed to recalculate users by role ${roleId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Create empty permissions object
   */
  private createEmptyPermissions(
    userId: string,
    tenantId: string
  ): ExpandedPermissions {
    return {
      userId,
      tenantId,
      permissions: new Set<string>(),
      calculatedAt: new Date(),
      ttl: this.cacheTTL,
    };
  }
}
