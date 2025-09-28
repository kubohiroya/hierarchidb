/**
  * Folder plugin utilities - UIWorker
  */

import type { NodeId, NodeType } from '@hierarchidb/common-type';
import type { CreateFolderData, FolderBreadcrumb, FolderDisplayData, FolderEntity, FolderTreeNode } from './types.js';
import { FOLDER_DISPLAY, FOLDER_VALIDATION } from './constants.js';

/**
 * ID generation utilities
 */
export function generateFolderId(): NodeId {
  return crypto.randomUUID() as NodeId;
}

const FOLDER_NODE_TYPE = 'folder' as NodeType;

/**
 * Validation utilities - now using common validation from @hierarchidb/core
 */

/**
 * @deprecated Use validateNodeName from @hierarchidb/core instead
 */
export function validateFolderName(name: string): { isValid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { isValid: false, error: 'Name is required' };
  }
  if (name.length > 255) {
    return { isValid: false, error: 'Name is too long' };
  }
  return { isValid: true };
}

/**
 * Validate folder-plugin creation/update data using common validation functions
 */
export function validateFolderData(data: CreateFolderData): { isValid: boolean; errors: string[] } {
  // Simple validation for folder data
  const errors: string[] = [];

  if (!data.name || data.name.trim().length === 0) {
    errors.push('Name is required');
  }

  if (data.name && data.name.length > 255) {
    errors.push('Name is too long');
  }

  // Add folder-plugin-specific validations if needed
  if (
    data.settings?.displayOptions?.iconColor &&
    !/^#[0-9A-Fa-f]{6}$/.test(data.settings.displayOptions.iconColor)
  ) {
    errors.push('Invalid icon color format');
  }

  if (data.settings?.rules?.maxChildren !== undefined) {
    const maxChildren = data.settings.rules.maxChildren;
    if (
      typeof maxChildren !== 'number' ||
      maxChildren < 0 ||
      maxChildren > FOLDER_VALIDATION.MAX_CHILDREN_ABSOLUTE
    ) {
      errors.push(`Max children must be between 0 and ${FOLDER_VALIDATION.MAX_CHILDREN_ABSOLUTE}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Display utilities
 */
const isPresetIconColor = (candidate: string): candidate is (typeof FOLDER_DISPLAY.ICON_COLORS)[number] =>
  (FOLDER_DISPLAY.ICON_COLORS as readonly string[]).includes(candidate);

export function isValidIconColor(color: string): boolean {
  return isPresetIconColor(color) || /^#[0-9A-Fa-f]{6}$/.test(color);
}

export function getDefaultIconColor(): string {
  return FOLDER_DISPLAY.DEFAULT_ICON_COLOR;
}

export function getRandomIconColor(): string {
  const colors = FOLDER_DISPLAY.ICON_COLORS;
  return colors[Math.floor(Math.random() * colors.length)] || FOLDER_DISPLAY.DEFAULT_ICON_COLOR;
}

export function sanitizeFolderName(name: string): string {
  return name
    .trim()
    .replace(/[<>:"/\\|?*]/g, '_') // Replace invalid chars with underscore
    .replace(/\s+/g, ' ') // Normalize whitespace
    .substring(0, FOLDER_VALIDATION.NAME_MAX_LENGTH);
}

export function createEmptyFolderEntity(nodeId: NodeId): FolderEntity {
  const now = Date.now();

  return {
    id: nodeId,
    parentId: nodeId,
    nodeType: FOLDER_NODE_TYPE,
    name: '',
    depth: 0,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

/**
 * Path utilities
 */
export function generateFolderPath(breadcrumbs: FolderBreadcrumb[]): string {
  return breadcrumbs
    .filter((b) => !b.isRoot)
    .map((b) => b.name)
    .join(' / ');
}

export function generateFolderBreadcrumbs(
  pathNodes: Array<{ nodeId: NodeId; name: string; isRoot: boolean }>,
): FolderBreadcrumb[] {
  return pathNodes.map((node) => ({
    nodeId: node.nodeId,
    name: node.name,
    isRoot: node.isRoot,
    isClickable: true, // Can be customized based on permissions
  }));
}

/**
 * TreeTypes utilities
 */
export function buildFolderTree(
  folders: FolderDisplayData[],
  parentId?: NodeId,
  level: number = 0,
): FolderTreeNode[] {
  const children = folders.filter(() => {
    // Filter logic would depend on actual parent-child relationships
    // This is a simplified version
    return level === 0 ? true : false;
  });

  return children.map((folder) => ({
    nodeId: folder.id,
    name: folder.name,
    parentId: parentId,
    children: [], // Would be populated recursively
    hasChildren: folder.hasChildren,
    isExpanded: false,
    isSelected: false,
    level,
    iconColor: folder.iconColor,
    isReadOnly: folder.isReadOnly,
  }));
}

export function flattenFolderTree(treeNodes: FolderTreeNode[]): FolderTreeNode[] {
  const result: FolderTreeNode[] = [];

  function traverse(nodes: FolderTreeNode[]) {
    for (const node of nodes) {
      result.push(node);
      if (node.children.length > 0) {
        traverse(node.children);
      }
    }
  }

  traverse(treeNodes);
  return result;
}

export function findFolderInTree(
  treeNodes: FolderTreeNode[],
  nodeId: NodeId,
): FolderTreeNode | undefined {
  for (const node of treeNodes) {
    if (node.nodeId === nodeId) {
      return node;
    }

    if (node.children.length > 0) {
      const found = findFolderInTree(node.children, nodeId);
      if (found) return found;
    }
  }

  return undefined;
}

/**
 * Search utilities
 */
export function createFolderSearchIndex(
  folders: FolderDisplayData[],
): Map<string, FolderDisplayData[]> {
  const index = new Map<string, FolderDisplayData[]>();

  folders.forEach((folder) => {
    // Index by name
    const nameWords = folder.name.toLowerCase().split(/\s+/);
    nameWords.forEach((word) => {
      if (word.length > 0) {
        if (!index.has(word)) {
          index.set(word, []);
        }
        index.get(word)!.push(folder);
      }
    });

    // Index by tags
    folder.tags.forEach((tag) => {
      const tagKey = tag.toLowerCase();
      if (!index.has(tagKey)) {
        index.set(tagKey, []);
      }
      index.get(tagKey)!.push(folder);
    });

    // Index by description
    if (folder.description) {
      const descWords = folder.description.toLowerCase().split(/\s+/);
      descWords.forEach((word) => {
        if (word.length > 2) {
          // Only index words longer than 2 characters
          if (!index.has(word)) {
            index.set(word, []);
          }
          index.get(word)!.push(folder);
        }
      });
    }
  });

  return index;
}

export function searchFoldersInIndex(
  index: Map<string, FolderDisplayData[]>,
  query: string,
): FolderDisplayData[] {
  if (!query.trim()) return [];

  const queryWords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 0);
  if (queryWords.length === 0) return [];

  // Get all folders matching any query word
  const matchingSets = queryWords.map((word) => {
    const matches = new Set<FolderDisplayData>();

    // Exact matches
    if (index.has(word)) {
      index.get(word)!.forEach((folder) => matches.add(folder));
    }

    // Partial matches
    for (const [indexWord, folders] of index.entries()) {
      if (indexWord.includes(word) || word.includes(indexWord)) {
        folders.forEach((folder) => matches.add(folder));
      }
    }

    return matches;
  });

  // Find intersection of all matching sets
  if (matchingSets.length === 0) return [];

  let result = matchingSets[0];
  if (!result) {
    return [];
  }

  for (let i = 1; i < matchingSets.length; i++) {
    const intersection = new Set<FolderDisplayData>();
    for (const folder of result) {
      if (matchingSets[i]?.has(folder)) {
        intersection.add(folder);
      }
    }
    result = intersection;
  }

  return Array.from(result);
}

/**
 * Sorting utilities
 */
export function sortFolders(
  folders: FolderDisplayData[],
  sortOrder: 'name' | 'date' | 'type' | 'custom' = 'name',
  sortDirection: 'asc' | 'desc' = 'asc',
): FolderDisplayData[] {
  const sorted = [...folders].sort((a, b) => {
    let comparison = 0;

    switch (sortOrder) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'date':
        comparison = a.updatedAt - b.updatedAt;
        break;
      case 'type':
        // Sort by hasChildren, then by name
        if (a.hasChildren !== b.hasChildren) {
          comparison = a.hasChildren ? -1 : 1;
        } else {
          comparison = a.name.localeCompare(b.name);
        }
        break;
      case 'custom':
        // Custom sorting would be based on user-defined order
        comparison = 0;
        break;
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

  return sorted;
}

/**
 * Performance utilities
 */
export function debounce<TArgs extends unknown[]>(func: (...args: TArgs) => void, delay: number): (...args: TArgs) => void {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  return (...args: TArgs) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
}

export function throttle<TArgs extends unknown[]>(func: (...args: TArgs) => void, delay: number): (...args: TArgs) => void {
  let lastCallTime = 0;

  return (...args: TArgs) => {
    const now = Date.now();
    if (now - lastCallTime < delay) return;
    lastCallTime = now;
    func(...args);
  };
}

export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
