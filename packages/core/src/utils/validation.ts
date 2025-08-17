import type { TreeNodeId } from '../types/base';

export function assertNonNull<T>(
  value: T | null | undefined,
  message: string = 'Value is required'
): asserts value is T {
  if (value == null) {
    throw new Error(message);
  }
}

export function isValidTreeNodeName(name: string): boolean {
  if (!name || name.trim().length === 0) {
    return false;
  }

  // Check for invalid characters
  const invalidChars = /[\\/:*?"<>|]/;
  if (invalidChars.test(name)) {
    return false;
  }

  // Check max length
  if (name.length > 255) {
    return false;
  }

  return true;
}

export function canMoveNode(
  nodeId: TreeNodeId,
  targetParentId: TreeNodeId,
  getAncestors: (id: TreeNodeId) => TreeNodeId[]
): boolean {
  // Cannot move to itself
  if (nodeId === targetParentId) {
    return false;
  }

  // Cannot move to descendant
  const targetAncestors = getAncestors(targetParentId);
  if (targetAncestors.includes(nodeId)) {
    return false;
  }

  return true;
}

/**
 * Validate external URL format and protocol
 */
export const validateExternalURL = (url: string): { isValid: boolean; error?: string } => {
  try {
    const urlObj = new URL(url);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return { isValid: false, error: 'URL must use HTTP or HTTPS protocol' };
    }
    return { isValid: true };
  } catch {
    return { isValid: false, error: 'Invalid URL format' };
  }
};
