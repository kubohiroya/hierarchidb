import type { TreeNode } from './tree-node-types.js';

function normalizeText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  return String(value);
}

export function getTreeNodeName(node: TreeNode): string {
  const metaRaw = (node as { metadata?: { name?: unknown } }).metadata?.name;
  const draftRaw = (node as { draftMetadata?: { name?: unknown } | null }).draftMetadata?.name;
  const metaName = normalizeText(metaRaw);

  if (draftRaw !== undefined && draftRaw !== null) {
    const draftName = normalizeText(draftRaw);
    if (draftName !== metaName) {
      return draftName;
    }
  }

  return metaName;
}

export function getTreeNodeDescription(node: TreeNode): string {
  const metaRaw = (node as { metadata?: { description?: unknown } }).metadata?.description;
  const draftRaw = (node as { draftMetadata?: { description?: unknown } | null }).draftMetadata?.description;
  const metaDescription = normalizeText(metaRaw);

  if (draftRaw !== undefined && draftRaw !== null) {
    const draftDescription = normalizeText(draftRaw);
    if (draftDescription !== metaDescription) {
      return draftDescription;
    }
  }

  return metaDescription;
}
