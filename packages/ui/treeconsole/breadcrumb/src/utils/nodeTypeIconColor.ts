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

// Static map sourced from plugin manifests to avoid a dependency edge on plugin-registry.
// Keep values in sync with plugins/*-plugin/package.json icon.color fields.
const pluginIconColorMap: ReadonlyMap<string, string> = new Map(
  [
    ['basemap', '#b0b3d9'],
    ['folder', '#c0eeff'],
    ['linker', '#ffe0f3'],
    ['location', '#a3b030'],
    ['resolver', '#ffb3c1'],
    ['route', '#a3b030'],
    ['shape', '#a3b030'],
    ['spreadsheet', '#a3b030'], // spreadsheet inherits shape color
    ['styler', '#dcbc50'],
    ['timeline', '#8a7cbf'],
  ].map(([nodeType, color]) => [nodeType, normalizeColor(color)!])
);

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
