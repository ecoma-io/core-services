import { Injectable, Logger } from '@nestjs/common';
import { IPermissionMergeService } from './ports/permission-merge.port';
import {
  MergedPermissionTree,
  PermissionMergeOptions,
  PermissionNode,
  VersionWithPriority,
} from './types';

/**
 * Service for merging permission trees from multiple versions
 * Implements ADR-5: Permission Merge Rules
 *
 * **Algorithm:**
 * 1. Parse versions and extract major/patch numbers
 * 2. Group by major version, keep latest patch per major
 * 3. Select top 3 major versions
 * 4. Calculate priority: (major * 1000) + patch
 * 5. Deep merge trees with priority-based conflict resolution
 *
 * **Priority Rules:**
 * - Higher major > lower major
 * - Same major: higher patch > lower patch
 *
 * **Merge Semantics:**
 * - Container node + container node = merged container with union of children
 * - Leaf node + leaf node = higher priority wins
 * - Leaf + container (or vice versa) = higher priority's type wins
 *
 * @see docs/iam/architecture.md ADR-5
 */
@Injectable()
export class PermissionMergeService implements IPermissionMergeService {
  private readonly logger = new Logger(PermissionMergeService.name);
  private readonly defaultOptions: Required<PermissionMergeOptions> = {
    maxMajorVersions: 3,
    includeMetadata: true,
    logLevel: 'info',
  };

  /**
   * Merge permission trees from multiple versions
   *
   * @param serviceName - Service identifier
   * @param versions - Array of version objects
   * @param options - Merge options
   * @returns Merged permission tree with metadata
   */
  async mergePermissions(
    serviceName: string,
    versions: Array<{ version: string; permissionsTree: PermissionNode[] }>,
    options?: PermissionMergeOptions
  ): Promise<MergedPermissionTree> {
    const opts = { ...this.defaultOptions, ...options };

    if (!serviceName || serviceName.trim() === '') {
      throw new Error('serviceName cannot be empty');
    }

    if (!versions || versions.length === 0) {
      throw new Error('versions array cannot be empty');
    }

    // Step 1: Parse versions and calculate priorities
    const parsedVersions = this.parseAndPrioritizeVersions(versions);

    // Step 2: Group by major, keep latest patch per major
    const latestPerMajor = this.selectLatestPatchPerMajor(parsedVersions);

    // Step 3: Select top N major versions
    const selectedVersions = latestPerMajor
      .sort((a, b) => b.priority - a.priority)
      .slice(0, opts.maxMajorVersions);

    if (selectedVersions.length === 0) {
      throw new Error('No valid versions found after filtering');
    }

    this.log(
      opts.logLevel,
      `Merging ${selectedVersions.length} versions for ${serviceName}: ${selectedVersions.map((v) => v.version).join(', ')}`
    );

    // Step 4: Merge trees with priority order (lowest to highest)
    // This ensures higher priority versions overwrite lower ones
    const resolutionMetadata: Record<
      string,
      { version: string; reason: string }
    > = {};
    let mergedTree: PermissionNode[] = [];

    // Reverse to merge from lowest priority to highest
    const reversedVersions = [...selectedVersions].reverse();

    for (const versionData of reversedVersions) {
      mergedTree = this.mergeTrees(
        mergedTree,
        versionData.permissionsTree,
        versionData.version,
        '',
        resolutionMetadata,
        opts.includeMetadata
      );
    }

    return {
      serviceName,
      combinedTree: mergedTree,
      mergedVersions: selectedVersions.map((v) => ({
        version: v.version,
        priority: v.priority,
        major: v.major,
      })),
      resolutionMetadata: opts.includeMetadata ? resolutionMetadata : {},
      mergedAt: new Date(),
    };
  }

  /**
   * Parse semver strings and calculate priorities
   */
  private parseAndPrioritizeVersions(
    versions: Array<{ version: string; permissionsTree: PermissionNode[] }>
  ): VersionWithPriority[] {
    return versions.map((v) => {
      const parsed = this.parseSemver(v.version);
      return {
        version: v.version,
        major: parsed.major,
        patch: parsed.patch,
        priority: parsed.major * 1000 + parsed.patch,
        permissionsTree: v.permissionsTree,
      };
    });
  }

  /**
   * Parse semantic version string
   * Supports: "1.2.3", "v1.2.3", "1.2.3-beta"
   *
   * @throws {Error} If invalid semver format
   */
  private parseSemver(version: string): { major: number; patch: number } {
    const cleaned = version.replace(/^v/, ''); // Remove 'v' prefix
    const match = cleaned.match(/^(\d+)\.(\d+)\.(\d+)/);

    if (!match) {
      throw new Error(
        `Invalid semver format: ${version}. Expected format: major.minor.patch`
      );
    }

    return {
      major: parseInt(match[1], 10),
      patch: parseInt(match[3], 10), // Use patch instead of minor for priority
    };
  }

  /**
   * Group versions by major, keep only latest patch per major
   */
  private selectLatestPatchPerMajor(
    versions: VersionWithPriority[]
  ): VersionWithPriority[] {
    const byMajor = new Map<number, VersionWithPriority>();

    for (const v of versions) {
      const existing = byMajor.get(v.major);
      if (!existing || v.patch > existing.patch) {
        byMajor.set(v.major, v);
      }
    }

    return Array.from(byMajor.values());
  }

  /**
   * Merge two permission trees
   * Recursively merges nodes with conflict resolution
   */
  private mergeTrees(
    base: PermissionNode[],
    incoming: PermissionNode[],
    incomingVersion: string,
    parentPath: string,
    resolutionMetadata: Record<string, { version: string; reason: string }>,
    includeMetadata: boolean
  ): PermissionNode[] {
    if (!incoming || incoming.length === 0) {
      return base;
    }

    if (!base || base.length === 0) {
      return incoming.map((node) =>
        this.addMetadata(node, incomingVersion, 'no-conflict', includeMetadata)
      );
    }

    const result: PermissionNode[] = [...base];

    for (const incomingNode of incoming) {
      const existingIndex = result.findIndex((n) => n.key === incomingNode.key);
      const currentPath = parentPath
        ? `${parentPath}:${incomingNode.key}`
        : incomingNode.key;

      if (existingIndex === -1) {
        // New node, add it
        result.push(
          this.addMetadata(
            incomingNode,
            incomingVersion,
            'new-node',
            includeMetadata
          )
        );
      } else {
        // Conflict: merge nodes
        const existingNode = result[existingIndex];
        result[existingIndex] = this.mergeNodes(
          existingNode,
          incomingNode,
          incomingVersion,
          currentPath
        );

        // Track resolution
        if (includeMetadata) {
          resolutionMetadata[currentPath] = {
            version: incomingVersion,
            reason: this.determineConflictReason(existingNode, incomingNode),
          };
        }
      }
    }

    return result;
  }

  /**
   * Merge two individual nodes with priority-based conflict resolution
   *
   * @param base - Base node (lower priority)
   * @param incoming - Incoming node (higher priority)
   * @param incomingVersion - Version string of incoming
   * @param path - Current path for audit
   * @returns Merged node
   */
  mergeNodes(
    base: PermissionNode,
    incoming: PermissionNode,
    incomingVersion: string,
    path: string
  ): PermissionNode {
    const baseIsContainer = base.children && base.children.length > 0;
    const incomingIsContainer =
      incoming.children && incoming.children.length > 0;

    // Case 1: Both are containers - merge children
    if (baseIsContainer && incomingIsContainer) {
      return {
        key: incoming.key,
        description: incoming.description || base.description,
        children: this.mergeTrees(
          base.children ?? [],
          incoming.children ?? [],
          incomingVersion,
          path,
          {},
          true
        ),
        metadata: {
          resolvedFrom: incomingVersion,
          reason: 'container-merge',
        },
      };
    }

    // Case 2: Type conflict (leaf vs container) - incoming wins (higher priority)
    if (baseIsContainer !== incomingIsContainer) {
      return {
        ...incoming,
        metadata: {
          resolvedFrom: incomingVersion,
          reason: 'type-conflict-higher-priority',
        },
      };
    }

    // Case 3: Both are leaves - incoming wins (higher priority)
    return {
      ...incoming,
      metadata: {
        resolvedFrom: incomingVersion,
        reason: 'leaf-conflict-higher-priority',
      },
    };
  }

  /**
   * Expand a permission key to include all nested children
   * Example: 'admin' -> ['admin', 'admin:user', 'admin:user:read', ...]
   *
   * @param permissionKey - Parent permission key
   * @param combinedTree - Merged permission tree
   * @returns Set of expanded permission keys
   */
  async expandPermission(
    permissionKey: string,
    combinedTree: PermissionNode[]
  ): Promise<Set<string>> {
    const expanded = new Set<string>();
    expanded.add(permissionKey); // Add the parent itself

    // Find the node in the tree
    const node = this.findNode(permissionKey, combinedTree);

    if (node && node.children && node.children.length > 0) {
      // Recursively expand children
      this.expandChildren(node.children, permissionKey, expanded);
    }

    return expanded;
  }

  /**
   * Find a node by key in the tree (supports nested paths like 'admin:user')
   */
  private findNode(key: string, tree: PermissionNode[]): PermissionNode | null {
    const parts = key.split(':');

    // Navigate down the tree following the path
    let currentTree = tree;
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      const searchKey = parts[i];
      const node = currentTree.find((n) => n.key === searchKey);

      if (!node) {
        return null; // Path not found
      }

      currentPath = currentPath ? `${currentPath}:${node.key}` : node.key;

      // If this is the last part, we found it
      if (i === parts.length - 1) {
        return node;
      }

      // Otherwise, navigate to children
      if (!node.children || node.children.length === 0) {
        return null; // Path incomplete
      }

      currentTree = node.children;
    }

    return null;
  }

  /**
   * Recursively expand all children
   */
  private expandChildren(
    children: PermissionNode[],
    parentPath: string,
    expanded: Set<string>
  ): void {
    for (const child of children) {
      const childPath = `${parentPath}:${child.key}`;
      expanded.add(childPath);

      if (child.children && child.children.length > 0) {
        this.expandChildren(child.children, childPath, expanded);
      }
    }
  }

  /**
   * Add metadata to a node
   */
  private addMetadata(
    node: PermissionNode,
    version: string,
    reason: string,
    includeMetadata: boolean
  ): PermissionNode {
    if (!includeMetadata) {
      return node;
    }

    return {
      ...node,
      metadata: {
        resolvedFrom: version,
        reason,
      },
      children: node.children?.map((child) =>
        this.addMetadata(child, version, reason, includeMetadata)
      ),
    };
  }

  /**
   * Determine conflict reason for audit
   */
  private determineConflictReason(
    base: PermissionNode,
    incoming: PermissionNode
  ): string {
    const baseIsContainer = base.children && base.children.length > 0;
    const incomingIsContainer =
      incoming.children && incoming.children.length > 0;

    if (baseIsContainer && incomingIsContainer) {
      return 'container-merge';
    }

    if (baseIsContainer !== incomingIsContainer) {
      return 'type-conflict';
    }

    return 'leaf-override';
  }

  /**
   * Log with configurable level
   */
  private log(level: string, message: string): void {
    switch (level) {
      case 'debug':
        this.logger.debug(message);
        break;
      case 'info':
        this.logger.log(message);
        break;
      case 'warn':
        this.logger.warn(message);
        break;
      case 'error':
        this.logger.error(message);
        break;
    }
  }
}
