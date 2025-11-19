/**
 * Permission Expansion Service
 *
 * @remarks
 * Expands high-level permission keys to include all nested child permissions
 * according to the rule: "quyền cấp cao tự động bao gồm quyền con".
 *
 * Example:
 * - Input: ['admin:all']
 * - Output: ['admin:all', 'admin:user', 'admin:user:read', 'admin:user:write', ...]
 *
 * Pure domain algorithm (tree traversal) - implementation in domain layer.
 */

import { PermissionKey } from '../value-objects';
import { ICombinedPermissionsTree } from './permission-merge.service';

/**
 * Expanded permission result.
 */
export interface IExpandedPermissions {
  /**
   * Flattened set of all permission keys (deduplicated).
   */
  keys: PermissionKey[];

  /**
   * Metadata about expansion.
   */
  metadata: {
    inputCount: number;
    expandedCount: number;
    expandedAt: string; // ISO timestamp
  };
}

/**
 * Permission matching result.
 */
export interface IPermissionMatchResult {
  /**
   * Whether the granted permissions cover the required permission.
   */
  matches: boolean;

  /**
   * Explanation of match result.
   */
  reason?: string;

  /**
   * Matched permission key (if matches=true).
   */
  matchedKey?: PermissionKey;
}

/**
 * Permission Expansion Service Interface.
 */
export interface IPermissionExpansionService {
  /**
   * Expand multiple permission keys to include all descendants.
   *
   * @param permissionKeys - High-level permission keys to expand
   * @param combinedTree - Combined permission tree to traverse
   * @returns Flattened expanded set with metadata
   *
   * @remarks
   * Algorithm:
   * 1. For each input key, find node in tree
   * 2. Recursively collect all child keys
   * 3. Add parent key itself
   * 4. Deduplicate final set
   *
   * Example:
   * - Input: ['admin:user', 'billing:read']
   * - Tree: admin:user → [admin:user:read, admin:user:write]
   * - Output: ['admin:user', 'admin:user:read', 'admin:user:write', 'billing:read']
   */
  expand(
    permissionKeys: PermissionKey[],
    combinedTree: ICombinedPermissionsTree
  ): IExpandedPermissions;

  /**
   * Expand a single permission key.
   *
   * @param key - Permission key to expand
   * @param combinedTree - Combined permission tree
   * @returns Array of expanded keys (includes parent)
   *
   * @remarks
   * Useful for incremental expansion or debugging.
   */
  expandSingle(
    key: PermissionKey,
    combinedTree: ICombinedPermissionsTree
  ): PermissionKey[];

  /**
   * Check if a required permission is covered by granted permissions.
   *
   * @param requiredKey - Permission required for operation
   * @param grantedKeys - Permissions granted to user (expanded or not)
   * @param combinedTree - Combined permission tree (for parent matching)
   * @returns Match result with explanation
   *
   * @remarks
   * Matching rules:
   * - Exact match: requiredKey in grantedKeys
   * - Parent match: granted 'admin:all' covers required 'admin:user:read'
   * - Use tree to check if any granted key is ancestor of required key
   *
   * Example:
   * - Required: 'admin:user:read'
   * - Granted: ['admin:all']
   * - Result: { matches: true, matchedKey: 'admin:all', reason: 'parent-covers-child' }
   */
  matches(
    requiredKey: PermissionKey,
    grantedKeys: PermissionKey[],
    combinedTree: ICombinedPermissionsTree
  ): IPermissionMatchResult;
}
