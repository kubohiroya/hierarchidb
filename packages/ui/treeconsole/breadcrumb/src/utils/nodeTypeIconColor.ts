const folderNodeTypeAliases = new Set<string>([
  'folder',
  'folder-plugin',
  'ProjectFolder',
  'ResourceFolder',
  'ProjectsRoot',
  'ResourcesRoot',
  'ProjectsArchiveRoot',
  'ResourcesArchiveRoot',
]);

function normalizeColor(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

// Static map sourced from plugin manifests to avoid a dependency edge on plugin-registry.
// Keep values in sync with plugins/*-plugin/package.json icon.color fields.
const pluginIconColorMap: ReadonlyMap<string, string> = new Map<string, string>(
  [
    ['basemap', normalizeColor('#b0b3d9')],
    ['folder', normalizeColor('#c0eeff')],
    ['linker', normalizeColor('#ffe0f3')],
    ['location', normalizeColor('#a3b030')],
    ['resolver', normalizeColor('#ffb3c1')],
    ['route', normalizeColor('#a3b030')],
    ['shape', normalizeColor('#a3b030')],
    ['spreadsheet', normalizeColor('#dcbc50')],
    ['styler', normalizeColor('#dcbc50')],
    ['timeline', normalizeColor('#8a7cbf')],
  ].map(([nodeType, color]) => [nodeType, color ?? '#808080'] as [string, string])
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
