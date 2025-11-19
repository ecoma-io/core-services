import {
  IPermissionExpansionService,
  IExpandedPermissions,
  IPermissionMatchResult,
} from '../permission-expansion.service';
import {
  ICombinedPermissionsTree,
  IPermissionTreeNode,
} from '../permission-merge.service';
import { PermissionKey } from '../../value-objects';

function findNodeByKey(
  tree: ICombinedPermissionsTree,
  key: PermissionKey | string
): IPermissionTreeNode | null {
  const keyStr =
    (key as any) && typeof (key as any).toString === 'function'
      ? (key as any).toString()
      : String(key);
  const stack: IPermissionTreeNode[] = [...tree.tree];
  while (stack.length) {
    const node = stack.shift()!;
    if (node.key === keyStr) return node;
    if (node.children) stack.push(...node.children);
  }
  return null;
}

function collectDescendants(node: IPermissionTreeNode, out: Set<string>) {
  out.add(node.key);
  if (!node.children) return;
  for (const c of node.children) collectDescendants(c, out);
}

export class PermissionExpansionServiceImpl
  implements IPermissionExpansionService
{
  expand(
    permissionKeys: PermissionKey[],
    combinedTree: ICombinedPermissionsTree
  ): IExpandedPermissions {
    const out = new Set<string>();
    for (const k of permissionKeys) {
      const node = findNodeByKey(combinedTree, k as any);
      if (node) collectDescendants(node, out);
      else out.add(String(k));
    }
    return {
      keys: Array.from(out) as any,
      metadata: {
        inputCount: permissionKeys.length,
        expandedCount: out.size,
        expandedAt: new Date().toISOString(),
      },
    } as IExpandedPermissions;
  }

  expandSingle(
    key: PermissionKey,
    combinedTree: ICombinedPermissionsTree
  ): PermissionKey[] {
    const node = findNodeByKey(combinedTree, key as any);
    if (!node) return [key];
    const set = new Set<string>();
    collectDescendants(node, set);
    return Array.from(set) as any;
  }

  matches(
    requiredKey: PermissionKey,
    grantedKeys: PermissionKey[],
    combinedTree: ICombinedPermissionsTree
  ): IPermissionMatchResult {
    // Exact match
    if (grantedKeys.includes(requiredKey))
      return { matches: true, matchedKey: requiredKey, reason: 'exact' };

    // Check parent relationships and special ':all' wildcard semantics
    const reqStr =
      (requiredKey as any) &&
      typeof (requiredKey as any).toString === 'function'
        ? (requiredKey as any).toString()
        : String(requiredKey);
    for (const g of grantedKeys as any[]) {
      const gStr =
        g && typeof g.toString === 'function' ? g.toString() : String(g);
      if (gStr === reqStr)
        return { matches: true, matchedKey: g as any, reason: 'exact' };
      // parent prefix covers child
      if (reqStr.startsWith(gStr + ':'))
        return {
          matches: true,
          matchedKey: g as any,
          reason: 'parent-covers-child',
        };
      // handle 'admin:all' style wildcard (last segment 'all' denotes full coverage)
      if (gStr.endsWith(':all')) {
        const prefix = gStr.slice(0, -4); // remove ':all'
        if (reqStr === prefix || reqStr.startsWith(prefix + ':')) {
          return {
            matches: true,
            matchedKey: g as any,
            reason: 'parent-covers-child',
          };
        }
      }
    }

    // Also handle case where granted key is a wildcard root that isn't a strict prefix (defensive)
    return { matches: false, reason: 'no-match' };
  }
}

export const PermissionExpansionService = new PermissionExpansionServiceImpl();
