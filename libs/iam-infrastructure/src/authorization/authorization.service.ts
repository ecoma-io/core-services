import { Injectable, Logger } from '@nestjs/common';
import { PermissionCacheRepository } from '../cache/permission-cache.repository';
import { UserPermissionService } from '../permissions/user-permission.service';

/**
 * Authorization Service
 * Implements ADR-5 Stage 3: Live Access Check
 *
 * **Flow:**
 * 1. Check Redis cache for user permissions (O(1) SISMEMBER)
 * 2. If cache miss → calculate permissions via UserPermissionService
 * 3. Return boolean result
 *
 * **Performance:**
 * - Cache hit: ~1ms (Redis SISMEMBER)
 * - Cache miss: ~50-100ms (PostgreSQL queries + Redis write)
 *
 * @see docs/iam/architecture.md ADR-5
 */
@Injectable()
export class AuthorizationService {
  private readonly logger = new Logger(AuthorizationService.name);

  constructor(
    private readonly cacheRepo: PermissionCacheRepository,
    private readonly userPermissionService: UserPermissionService
  ) {}

  /**
   * Check if user has a specific permission in a tenant
   *
   * @param userId - User ID
   * @param tenantId - Tenant ID
   * @param permissionKey - Permission to check (e.g., 'admin:user:read')
   * @returns True if user has permission, false otherwise
   *
   * @example
   * ```ts
   * const hasPermission = await authService.checkPermission(
   *   'user-123',
   *   'tenant-456',
   *   'admin:user:read'
   * );
   * if (hasPermission) {
   *   // Allow access
   * }
   * ```
   */
  async checkPermission(
    userId: string,
    tenantId: string,
    permissionKey: string
  ): Promise<boolean> {
    this.logger.debug(
      `Checking permission ${permissionKey} for user ${userId} in tenant ${tenantId}`
    );

    try {
      // Step 1: Try to get cached permissions from Redis
      const cachedPermissions = await this.cacheRepo.getUserPermissions(
        userId,
        tenantId
      );

      if (cachedPermissions) {
        // Cache hit - O(1) check
        const hasPermission = cachedPermissions.includes(permissionKey);

        this.logger.debug(
          `[CACHE HIT] Permission ${permissionKey}: ${hasPermission}`
        );

        return hasPermission;
      }

      // Step 2: Cache miss - calculate permissions
      this.logger.debug(
        `[CACHE MISS] Calculating permissions for user ${userId}`
      );

      const expandedPermissions =
        await this.userPermissionService.calculateAndCacheUserPermissions(
          userId,
          tenantId
        );

      // Step 3: Check if permission exists in calculated set
      const hasPermission = expandedPermissions.permissions.has(permissionKey);

      this.logger.debug(
        `Permission ${permissionKey} calculated: ${hasPermission}`
      );

      return hasPermission;
    } catch (error) {
      this.logger.error(
        `Failed to check permission ${permissionKey} for user ${userId}:`,
        error
      );

      // Fail-safe: deny access on error
      return false;
    }
  }

  /**
   * Check if user has ANY of the given permissions
   *
   * @param userId - User ID
   * @param tenantId - Tenant ID
   * @param permissionKeys - Array of permissions to check
   * @returns True if user has at least one permission
   *
   * @example
   * ```ts
   * const canEdit = await authService.checkAnyPermission(
   *   'user-123',
   *   'tenant-456',
   *   ['admin:user:write', 'editor:user:write']
   * );
   * ```
   */
  async checkAnyPermission(
    userId: string,
    tenantId: string,
    permissionKeys: string[]
  ): Promise<boolean> {
    if (!permissionKeys || permissionKeys.length === 0) {
      return false;
    }

    try {
      const cachedPermissions = await this.cacheRepo.getUserPermissions(
        userId,
        tenantId
      );

      if (cachedPermissions) {
        // Cache hit - check any match
        return permissionKeys.some((key) => cachedPermissions.includes(key));
      }

      // Cache miss - calculate and check
      const expandedPermissions =
        await this.userPermissionService.calculateAndCacheUserPermissions(
          userId,
          tenantId
        );

      return permissionKeys.some((key) =>
        expandedPermissions.permissions.has(key)
      );
    } catch (error) {
      this.logger.error(
        `Failed to check any permission for user ${userId}:`,
        error
      );
      return false;
    }
  }

  /**
   * Check if user has ALL of the given permissions
   *
   * @param userId - User ID
   * @param tenantId - Tenant ID
   * @param permissionKeys - Array of permissions to check
   * @returns True if user has all permissions
   *
   * @example
   * ```ts
   * const canManage = await authService.checkAllPermissions(
   *   'user-123',
   *   'tenant-456',
   *   ['admin:user:read', 'admin:user:write']
   * );
   * ```
   */
  async checkAllPermissions(
    userId: string,
    tenantId: string,
    permissionKeys: string[]
  ): Promise<boolean> {
    if (!permissionKeys || permissionKeys.length === 0) {
      return true; // No permissions required = granted
    }

    try {
      const cachedPermissions = await this.cacheRepo.getUserPermissions(
        userId,
        tenantId
      );

      if (cachedPermissions) {
        // Cache hit - check all match
        return permissionKeys.every((key) => cachedPermissions.includes(key));
      }

      // Cache miss - calculate and check
      const expandedPermissions =
        await this.userPermissionService.calculateAndCacheUserPermissions(
          userId,
          tenantId
        );

      return permissionKeys.every((key) =>
        expandedPermissions.permissions.has(key)
      );
    } catch (error) {
      this.logger.error(
        `Failed to check all permissions for user ${userId}:`,
        error
      );
      return false;
    }
  }

  /**
   * Get all permissions for a user (for debugging/admin UI)
   *
   * @param userId - User ID
   * @param tenantId - Tenant ID
   * @returns Array of permission keys
   */
  async getUserPermissions(
    userId: string,
    tenantId: string
  ): Promise<string[]> {
    try {
      const cachedPermissions = await this.cacheRepo.getUserPermissions(
        userId,
        tenantId
      );

      if (cachedPermissions) {
        return cachedPermissions;
      }

      // Calculate if not cached
      const expandedPermissions =
        await this.userPermissionService.calculateAndCacheUserPermissions(
          userId,
          tenantId
        );

      return Array.from(expandedPermissions.permissions);
    } catch (error) {
      this.logger.error(`Failed to get permissions for user ${userId}:`, error);
      return [];
    }
  }
}
