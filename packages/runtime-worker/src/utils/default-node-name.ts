import { pluginRegistry } from '~/plugin-registry/index';

function titleCase(input: string): string {
  const words = input.replace(/[-_]+/g, ' ').split(' ').filter(Boolean);
  if (words.length === 0) return input;
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

const cache = new Map<string, string>();

/**
 * Resolve the default display name for a node type using plugin metadata.
 * Falls back to a title-cased node type when metadata is missing.
 */
export function resolveDefaultNodeName(nodeType: string): string {
  const key = nodeType.toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;

  const normalized = key.replace(/-plugin$/i, '');
  const entry = pluginRegistry.find((item) => item.nodeType.toLowerCase() === normalized);
  const displayName =
    entry?.manifest?.displayName?.trim() || entry?.manifest?.name?.trim() || titleCase(normalized);
  const value = `New ${displayName}`.trim();
  cache.set(key, value);
  return value;
}
