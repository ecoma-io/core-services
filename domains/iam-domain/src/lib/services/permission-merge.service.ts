/**
 * Permission Merge Service
 *
 * @remarks
 * Merges permission trees from multiple service versions according to
 * business rules (ADR-IAM-4):
 * - Select top 3 major versions (highest minor+patch per major)
 * - Deep-merge trees with semver priority (higher version wins conflicts)
 * - Track provenance (source service/version) for audit
 *
 * Pure domain logic (no I/O) - implementation in domain layer.
 *
 * @see ADR-IAM-4 — Quy tắc Merge Quyền (Permissions Merge Rules)
 */

/**
 * Permission tree node structure.
 */
export interface IPermissionTreeNode {
  key: string;
  description?: string;
  children?: PermissionTreeNode[];
  metadata?: Record<string, unknown>;
}

/**
 * Root permission tree structure.
 */
export type PermissionTree = IPermissionTreeNode[];

/**
 * Service version with semantic versioning.
 */
export interface IServiceVersion {
  version: string; // Semver format: "1.2.3"
  permissionsTree: PermissionTree;
  serviceId: string;
  serviceName: string;
}

/**
 * Provenance metadata for merged nodes.
 */
export interface IProvenanceMetadata {
  sourceService: string;
  sourceVersion: string;
  mergedAt: string; // ISO timestamp
  conflictResolution?: {
    winnerVersion: string;
    loserVersions: string[];
    reason: string; // e.g., "leaf-overrides-container", "semver-priority"
  };
}

/**
 * Combined permissions tree with provenance tracking.
 */
export interface ICombinedPermissionsTree {
  tree: PermissionTree;
  metadata: {
    combinedFrom: Array<{ service: string; version: string }>;
    mergedAt: string;
    globalVersion: number; // Incremental version for cache invalidation
  };
  provenance: Map<string, IProvenanceMetadata>; // key → provenance
}

/**
 * Merge options for conflict resolution.
 */
export interface IMergeOptions {
  /**
   * When leaf conflicts with container, default behavior is leaf wins.
   */
  leafOverridesContainer?: boolean;

  /**
   * Track detailed provenance for audit (adds overhead).
   */
  trackProvenance?: boolean;

  /**
   * Validation mode (strict throws on invalid tree structure).
   */
  validationMode?: 'strict' | 'lenient';
}

/**
 * Validation result for merged tree.
 */
export interface IValidationResult {
  valid: boolean;
  errors?: Array<{
    path: string;
    message: string;
    severity: 'error' | 'warning';
  }>;
}

/**
 * Permission Merge Service Interface.
 */
export interface IPermissionMergeService {
  /**
   * Select top 3 major versions from all service versions.
   *
   * @param serviceId - Service identifier
   * @param allVersions - All available versions for the service
   * @returns Top 3 versions (one per major, highest minor+patch)
   *
   * @remarks
   * Selection algorithm:
   * 1. Group versions by major
   * 2. Sort majors descending, take top 3
   * 3. For each major, select highest minor → highest patch
   */
  selectRelevantVersions(
    serviceId: string,
    allVersions: IServiceVersion[]
  ): IServiceVersion[];

  /**
   * Deep-merge permission trees with conflict resolution.
   *
   * @param versions - Service versions to merge (pre-sorted by priority)
   * @param options - Merge behavior options
   * @returns Combined tree with provenance metadata
   *
   * @remarks
   * Merge rules:
   * - Higher semver version wins conflicts
   * - Deep-merge containers recursively
   * - Leaf vs container: configurable (default leaf wins)
   * - Provenance tracked for each node
   */
  mergeTrees(
    versions: IServiceVersion[],
    options?: IMergeOptions
  ): ICombinedPermissionsTree;

  /**
   * Validate merged tree structure.
   *
   * @param tree - Combined tree to validate
   * @returns Validation result with errors/warnings
   *
   * @remarks
   * Checks:
   * - No duplicate keys at same level
   * - Valid key format (lowercase, colon-separated)
   * - No cycles in tree structure
   * - Provenance consistency
   */
  validateMergedTree(tree: ICombinedPermissionsTree): IValidationResult;
}
