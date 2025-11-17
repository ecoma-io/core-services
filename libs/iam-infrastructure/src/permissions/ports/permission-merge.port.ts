import {
  MergedPermissionTree,
  PermissionMergeOptions,
  PermissionNode,
} from '../types';

/**
 * Port (interface) for permission merge service
 * Defines contract for merging multiple permission tree versions
 *
 * @see ADR-5 in docs/iam/architecture.md
 */
export interface IPermissionMergeService {
  /**
   * Merge permission trees from multiple versions of a service.
   * Takes max 3 latest major versions and merges them according to priority rules.
   *
   * **Priority Rules:**
   * - Higher major version > lower major version
   * - Same major: higher patch > lower patch
   * - Priority = (major * 1000) + patch
   *
   * **Merge Strategy:**
   * - Deep merge: recursively merge children
   * - Conflict resolution: higher priority wins
   * - Type conflicts (leaf vs container): higher priority's type wins
   * - Metadata tracking: record which version won each conflict
   *
   * @param serviceName - Service identifier (e.g., 'billing-service')
   * @param versions - Array of version objects with { version, permissionsTree }
   * @param options - Merge options
   * @returns Merged permission tree with metadata
   *
   * @throws {Error} If serviceName is empty
   * @throws {Error} If versions array is empty
   * @throws {Error} If invalid semver format
   *
   * @example
   * ```ts
   * const result = await mergeService.mergePermissions(
   *   'billing-service',
   *   [
   *     { version: '3.0.1', permissionsTree: [...] },
   *     { version: '2.5.0', permissionsTree: [...] },
   *     { version: '1.0.0', permissionsTree: [...] },
   *   ]
   * );
   * // Returns merged tree from 3.x, 2.x, 1.x with 3.x having highest priority
   * ```
   */
  mergePermissions(
    serviceName: string,
    versions: Array<{ version: string; permissionsTree: PermissionNode[] }>,
    options?: PermissionMergeOptions
  ): Promise<MergedPermissionTree>;

  /**
   * Merge two permission nodes with priority-based conflict resolution.
   * Internal method used during tree traversal.
   *
   * @param base - Base node (lower priority)
   * @param incoming - Incoming node (higher priority)
   * @param incomingVersion - Version string of incoming node (for metadata)
   * @param path - Current path in tree (for audit trail)
   * @returns Merged node with metadata
   */
  mergeNodes(
    base: PermissionNode,
    incoming: PermissionNode,
    incomingVersion: string,
    path: string
  ): PermissionNode;

  /**
   * Expand a permission key to include all nested children.
   * Example: 'admin' -> ['admin', 'admin:user', 'admin:user:read', ...]
   *
   * @param permissionKey - Parent permission key
   * @param combinedTree - Merged permission tree to expand from
   * @returns Set of expanded permission keys
   *
   * @example
   * ```ts
   * const expanded = await mergeService.expandPermission('admin', tree);
   * // Returns: Set(['admin', 'admin:user', 'admin:user:read', ...])
   * ```
   */
  expandPermission(
    permissionKey: string,
    combinedTree: PermissionNode[]
  ): Promise<Set<string>>;
}
