/**
 * Folder plugin utilities - UI・Worker共通ユーティリティ
 */

import {
  NodeId,
  EntityId,
  validateCommonNodeData,
  validateNodeName,
} from '@hierarchidb/common-core';
import {
  FolderEntity,
  FolderDisplayData,
  FolderBreadcrumb,
  FolderTreeNode,
  CreateFolderData,
} from './types';
import { FOLDER_VALIDATION, FOLDER_DISPLAY } from './constants';

/**
 * ID generation utilities
 */
export function generateFolderId(): EntityId {
  return crypto.randomUUID() as EntityId;
}

export function generateBookmarkId(): string {
  return crypto.randomUUID();
}

export function generateTemplateId(): string {
  return crypto.randomUUID();
}

/**
 * Validation utilities - now using common validation from @hierarchidb/core
 */

/**
 * @deprecated Use validateNodeName from @hierarchidb/core instead
 */
export function validateFolderName(name: string): { isValid: boolean; error?: string } {
  return validateNodeName(name);
}

/**
 * Validate folder creation/update data using common validation functions
 */
export function validateFolderData(data: CreateFolderData): { isValid: boolean; errors: string[] } {
  // Use common validation for name, description, and tags
  const commonValidation = validateCommonNodeData({
    name: data.name,
    description: data.description,
    tags: data.tags,
  });

  const errors: string[] = commonValidation.errors || [];

  // Add folder-specific validations if needed
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
export function isValidIconColor(color: string): boolean {
  return FOLDER_DISPLAY.ICON_COLORS.includes(color as any) || /^#[0-9A-Fa-f]{6}$/.test(color);
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

/**
 * Entity conversion utilities
 */
export function folderEntityToDisplayData(
  entity: FolderEntity,
  childCount: number = 0
): FolderDisplayData {
  return {
    id: entity.nodeId,
    name: entity.name,
    description: entity.description,
    iconColor: entity.settings?.displayOptions?.iconColor || getDefaultIconColor(),
    hasChildren: childCount > 0,
    childCount,
    isReadOnly: entity.settings?.permissions?.isReadOnly || false,
    isPublic: entity.settings?.permissions?.isPublic || false,
    tags: entity.tags || [],
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    lastAccessedAt: entity.statistics?.lastAccessedAt,
    accessCount: entity.statistics?.accessCount,
  };
}

export function createEmptyFolderEntity(nodeId: NodeId, name: string): FolderEntity {
  const now = Date.now();

  return {
    id: generateFolderId(),
    nodeId,
    name: sanitizeFolderName(name),
    settings: {
      displayOptions: {
        iconColor: getDefaultIconColor(),
        iconType: 'default',
        sortOrder: 'name',
        sortDirection: 'asc',
        viewMode: 'list',
      },
      permissions: {
        isPublic: false,
        isReadOnly: false,
        allowedUsers: [],
        deniedUsers: [],
      },
      rules: {
        maxChildren: FOLDER_VALIDATION.MAX_CHILDREN_DEFAULT,
        allowedChildTypes: [],
        autoArchiveAfterDays: undefined,
        requireApprovalForChanges: false,
      },
    },
    statistics: {
      childCount: 0,
      descendantCount: 0,
      accessCount: 0,
    },
    tags: [],
    metadata: {},
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
  pathNodes: Array<{ nodeId: NodeId; name: string; isRoot: boolean }>
): FolderBreadcrumb[] {
  return pathNodes.map((node) => ({
    nodeId: node.nodeId,
    name: node.name,
    isRoot: node.isRoot,
    isClickable: true, // Can be customized based on permissions
  }));
}

/**
 * Tree utilities
 */
export function buildFolderTree(
  folders: FolderDisplayData[],
  parentId?: NodeId,
  level: number = 0
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
  nodeId: NodeId
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
  folders: FolderDisplayData[]
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
  query: string
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
  sortDirection: 'asc' | 'desc' = 'asc'
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
 * Permission utilities
 */
export function hasPermission(
  folder: FolderEntity,
  userId: string,
  operation: 'read' | 'write' | 'delete' | 'move' | 'create_child'
): boolean {
  const permissions = folder.settings?.permissions;
  if (!permissions) return true; // Default allow all if no permissions set

  // Check explicit deny
  if (permissions.deniedUsers?.includes(userId)) {
    return false;
  }

  // Check read-only for write operations
  if (permissions.isReadOnly && ['write', 'delete', 'move', 'create_child'].includes(operation)) {
    return false;
  }

  // Check public access for read operations
  if (operation === 'read' && permissions.isPublic) {
    return true;
  }

  // Check explicit allow
  if (permissions.allowedUsers && permissions.allowedUsers.length > 0) {
    return permissions.allowedUsers.includes(userId);
  }

  // Default behavior based on public setting
  return permissions.isPublic || false;
}

/**
 * Statistics utilities
 */
export function calculateFolderStatistics(
  folder: FolderEntity,
  childFolders: FolderEntity[]
): FolderEntity['statistics'] {
  const childCount = childFolders.length;
  const descendantCount = childFolders.reduce(
    (total, child) => total + (child.statistics?.descendantCount || 0) + 1,
    0
  );

  return {
    childCount,
    descendantCount,
    totalSize: childFolders.reduce((total, child) => total + (child.statistics?.totalSize || 0), 0),
    lastAccessedAt: folder.statistics?.lastAccessedAt || folder.updatedAt,
    accessCount: folder.statistics?.accessCount || 0,
  };
}

/**
 * Performance utilities
 */
export function debounce<T extends (...args: any[]) => any>(func: T, delay: number): T {
  let timeoutId: NodeJS.Timeout;

  return ((...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  }) as T;
}

export function throttle<T extends (...args: any[]) => any>(func: T, delay: number): T {
  let lastCallTime = 0;

  return ((...args: any[]) => {
    const now = Date.now();
    if (now - lastCallTime >= delay) {
      lastCallTime = now;
      return func(...args);
    }
  }) as T;
}

export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
