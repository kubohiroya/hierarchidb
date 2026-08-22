import type { TreeNode } from '@hierarchidb/tree-api';

type TreeNodeWithTags = TreeNode & Record<string, unknown>;

export const EMPTY_SET = new Set<string>();

export const normalizeNodeKey = (
  value: TreeNode['id'] | TreeNode['parentId'] | string | number | null | undefined
): string | null => {
  if (value === null || value === undefined) return null;
  return String(value);
};

export const extractTags = (node: TreeNode): string[] => {
  const candidate = (node as TreeNodeWithTags).tags;
  if (!Array.isArray(candidate)) return [];
  return candidate.filter((tag): tag is string => typeof tag === 'string');
};

export const isElementWithClosest = (value: EventTarget | null): value is Element => {
  return value instanceof Element && typeof value.closest === 'function';
};
