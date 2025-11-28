import type { NodeId, TreeNode } from '@hierarchidb/common-types';
import type { CoreDB } from '../CoreDB.js';

export async function getChildNames(coreDB: CoreDB, parentId: NodeId): Promise<string[]> {
  const children = await coreDB.listChildren(parentId);
  return children.map((child: TreeNode) => child.metadata.name);
}

export function createNewName(siblingNames: string[], baseName: string): string {
  if (!siblingNames.includes(baseName)) {
    return baseName;
  }

  const escapedBase = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escapedBase}\\s*\\((\\d+)\\)$`);

  const existingNumbers = siblingNames
    .map((name) => {
      const match = pattern.exec(name);
      return match?.[1] ? parseInt(match[1], 10) : 0;
    })
    .filter((n) => n > 0);

  const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 2;
  return `${baseName} (${nextNumber})`;
}
