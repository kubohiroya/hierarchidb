import { pluginRegistry } from '@hierarchidb/plugin-registry';
import type { PluginRegistryEntry } from '@hierarchidb/plugin-registry/types';

const folderNodeTypeAliases = new Set<string>([
  'folder',
  'folder-plugin',
  'ProjectFolder',
  'ResourceFolder',
  'ProjectsRoot',
  'ResourcesRoot',
  'ProjectsTrashRoot',
  'ResourcesTrashRoot',
]);

function normalizeColor(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

const pluginIconColorMap: ReadonlyMap<string, string> = (() => {
  const pairs: Array<[string, string]> = [];
  for (const entry of pluginRegistry as readonly PluginRegistryEntry[]) {
    const color = normalizeColor(entry.manifest?.icon?.color);
    if (color) {
      pairs.push([entry.nodeType, color]);
    }
  }
  return new Map(pairs);
})();

export function isFolderNodeType(nodeType?: string | null): boolean {
  if (!nodeType) return false;
  if (folderNodeTypeAliases.has(nodeType)) return true;
  const normalized = nodeType.trim();
  if (folderNodeTypeAliases.has(normalized)) return true;
  return /folder$/i.test(normalized);
}

export function getPluginIconColor(nodeType?: string | null): string | undefined {
  if (!nodeType) return undefined;
  return pluginIconColorMap.get(nodeType);
}
