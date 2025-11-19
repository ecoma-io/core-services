import {
  IMergeOptions,
  ICombinedPermissionsTree,
  IProvenanceMetadata,
  IServiceVersion,
  PermissionTree,
  IPermissionTreeNode,
  IValidationResult,
} from '../permission-merge.service';

function parseSemver(v: string) {
  const [major, minor, patch] = v.split('.').map((s) => parseInt(s, 10) || 0);
  return { major, minor, patch };
}

function compareSemverDesc(a: string, b: string) {
  const A = parseSemver(a);
  const B = parseSemver(b);
  if (A.major !== B.major) return B.major - A.major;
  if (A.minor !== B.minor) return B.minor - A.minor;
  return B.patch - A.patch;
}

function cloneNode(n: IPermissionTreeNode): IPermissionTreeNode {
  return {
    key: n.key,
    description: n.description,
    metadata: n.metadata ? { ...n.metadata } : undefined,
    children: n.children ? n.children.map(cloneNode) : undefined,
  };
}

export class PermissionMergeServiceImpl {
  selectRelevantVersions(serviceId: string, allVersions: IServiceVersion[]) {
    const byMajor = new Map<number, IServiceVersion[]>();
    for (const v of allVersions) {
      const { major } = parseSemver(v.version);
      const arr = byMajor.get(major) || [];
      arr.push(v);
      byMajor.set(major, arr);
    }

    const majors = Array.from(byMajor.keys()).sort((a, b) => b - a);
    const selected: IServiceVersion[] = [];
    for (const major of majors.slice(0, 3)) {
      const versions = byMajor.get(major) || [];
      versions.sort((x, y) => compareSemverDesc(x.version, y.version));
      selected.push(versions[0]);
    }
    return selected;
  }

  mergeTrees(
    versions: IServiceVersion[],
    options?: IMergeOptions
  ): ICombinedPermissionsTree {
    const opts = Object.assign(
      {
        leafOverridesContainer: true,
        trackProvenance: true,
        validationMode: 'lenient',
      } as IMergeOptions,
      options || {}
    );

    // versions expected pre-sorted by priority (highest first). If not, sort by semver desc
    const sorted = [...versions].sort((a, b) =>
      compareSemverDesc(a.version, b.version)
    );

    const provenance = new Map<string, IProvenanceMetadata>();

    // Helper: merge two nodes by key
    function mergeNode(
      existing: IPermissionTreeNode | undefined,
      incoming: IPermissionTreeNode,
      version: IServiceVersion
    ): IPermissionTreeNode {
      if (!existing) {
        const cloned = cloneNode(incoming);
        if (opts.trackProvenance) {
          provenance.set(cloned.key, {
            sourceService: version.serviceName || version.serviceId,
            sourceVersion: version.version,
            mergedAt: new Date().toISOString(),
          });
        }
        return cloned;
      }

      const existingIsContainer = !!(
        existing.children && existing.children.length > 0
      );
      const incomingIsContainer = !!(
        incoming.children && incoming.children.length > 0
      );

      // Leaf vs container
      if (!incomingIsContainer && existingIsContainer) {
        if (opts.leafOverridesContainer) {
          const cloned = cloneNode(incoming);
          if (opts.trackProvenance) {
            provenance.set(cloned.key, {
              sourceService: version.serviceName || version.serviceId,
              sourceVersion: version.version,
              mergedAt: new Date().toISOString(),
              conflictResolution: {
                winnerVersion: version.version,
                loserVersions: [],
                reason: 'leaf-overrides-container',
              },
            });
          }
          return cloned;
        } else {
          // keep existing container
        }
      }

      if (incomingIsContainer && !existingIsContainer) {
        // existing is leaf, incoming is container
        if (opts.leafOverridesContainer) {
          // existing leaf wins -> keep existing
          return existing;
        } else {
          // container should win → replace
          const cloned = cloneNode(incoming);
          if (opts.trackProvenance) {
            provenance.set(cloned.key, {
              sourceService: version.serviceName || version.serviceId,
              sourceVersion: version.version,
              mergedAt: new Date().toISOString(),
            });
          }
          return cloned;
        }
      }

      // both containers or both leaves — for leaves, priority means incoming should override
      const result: IPermissionTreeNode = {
        key: incoming.key,
        description: existing.description ?? incoming.description,
        metadata: Object.assign(
          {},
          incoming.metadata || {},
          existing.metadata || {}
        ),
        children: undefined,
      };

      // merge children if any
      const existingChildren = existing.children || [];
      const incomingChildren = incoming.children || [];
      const map = new Map<string, IPermissionTreeNode>();
      for (const c of existingChildren) map.set(c.key, cloneNode(c));
      for (const c of incomingChildren) {
        const prev = map.get(c.key);
        map.set(c.key, mergeNode(prev, c, version));
      }
      result.children = Array.from(map.values());

      if (opts.trackProvenance) {
        provenance.set(result.key, {
          sourceService: version.serviceName || version.serviceId,
          sourceVersion: version.version,
          mergedAt: new Date().toISOString(),
        });
      }

      return result;
    }

    // Build combined tree by iterating versions in priority order and merging
    const combinedMap = new Map<string, IPermissionTreeNode>();
    for (const v of sorted) {
      const tree = v.permissionsTree || [];
      for (const node of tree) {
        const existing = combinedMap.get(node.key);
        combinedMap.set(node.key, mergeNode(existing, node, v));
      }
    }

    const tree = Array.from(combinedMap.values());

    const combined: ICombinedPermissionsTree = {
      tree,
      metadata: {
        combinedFrom: versions.map((v) => ({
          service: v.serviceName || v.serviceId,
          version: v.version,
        })),
        mergedAt: new Date().toISOString(),
        globalVersion: Date.now(),
      },
      provenance,
    };

    return combined;
  }

  validateMergedTree(tree: ICombinedPermissionsTree): IValidationResult {
    const errors: IValidationResult['errors'] = [];
    // simple duplicate key check at root level
    const keys = new Set<string>();
    for (const n of tree.tree) {
      if (keys.has(n.key)) {
        errors.push({
          path: n.key,
          message: 'Duplicate key at root level',
          severity: 'error',
        });
      }
      keys.add(n.key);
    }

    return {
      valid: errors.length === 0,
      errors: errors.length ? errors : undefined,
    };
  }
}

export const PermissionMergeService = new PermissionMergeServiceImpl();
