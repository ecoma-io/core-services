/**
 * Permission system types and interfaces
 * Reference: ADR-5 - Permission Merge Rules
 */

/**
 * A node in the permission tree.
 * Can be either a leaf permission or a container with children.
 */
export interface PermissionNode {
  /**
   * Permission key (e.g., 'admin', 'user', 'read')
   * Full path is constructed by joining parent keys with ':'
   */
  key: string;

  /**
   * Human-readable description
   */
  description?: string;

  /**
   * Child permissions (nested structure)
   * If present, this is a container node
   * If undefined/empty, this is a leaf permission
   */
  children?: PermissionNode[];

  /**
   * Metadata for audit trail (set during merge)
   */
  metadata?: {
    /**
     * Which version this node came from
     */
    resolvedFrom?: string;

    /**
     * Why this version won (e.g., 'higher-major', 'higher-patch')
     */
    reason?: string;
  };
}

/**
 * Represents a service's permission version with priority
 */
export interface VersionWithPriority {
  /**
   * Semantic version (e.g., '2.1.3')
   */
  version: string;

  /**
   * Major version number (e.g., 2)
   */
  major: number;

  /**
   * Patch version number (e.g., 3)
   */
  patch: number;

  /**
   * Priority for merge conflict resolution
   * Higher priority wins conflicts
   * Calculated as: (major * 1000) + patch
   */
  priority: number;

  /**
   * The actual permission tree from this version
   */
  permissionsTree: PermissionNode[];
}

/**
 * Result of merging multiple permission versions
 */
export interface MergedPermissionTree {
  /**
   * Service identifier
   */
  serviceName: string;

  /**
   * The merged permission tree
   */
  combinedTree: PermissionNode[];

  /**
   * Versions that were merged (max 3, sorted by priority desc)
   */
  mergedVersions: Array<{
    version: string;
    priority: number;
    major: number;
  }>;

  /**
   * Audit metadata about conflict resolutions
   * Map of permission path to resolution info
   */
  resolutionMetadata: Record<
    string,
    {
      version: string;
      reason: string;
    }
  >;

  /**
   * When this merge was performed
   */
  mergedAt: Date;
}

/**
 * Options for permission merge operation
 */
export interface PermissionMergeOptions {
  /**
   * Maximum number of major versions to keep
   * @default 3
   */
  maxMajorVersions?: number;

  /**
   * Whether to include audit metadata in result
   * @default true
   */
  includeMetadata?: boolean;

  /**
   * Log level for merge operations
   * @default 'info'
   */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Expanded permission set for a user
 */
export interface ExpandedPermissions {
  /**
   * User ID
   */
  userId: string;

  /**
   * Tenant/namespace ID
   */
  tenantId: string;

  /**
   * Flat set of all permission keys the user has
   * Includes parent permissions and all expanded children
   * Example: ['admin', 'admin:user', 'admin:user:read', 'admin:user:write']
   */
  permissions: Set<string>;

  /**
   * When these permissions were calculated
   */
  calculatedAt: Date;

  /**
   * TTL for cache (in seconds)
   */
  ttl: number;
}
