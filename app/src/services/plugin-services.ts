// Thin facade that lazily resolves plugin-specific helpers via dynamic import.
// Maintains backward-compatible API (`loadPluginService`) without relying on
// the legacy virtual:plugin-registry-services module.

type Loader = () => Promise<unknown>;

const loaderMap: Record<string, Loader> = {
  basemap: async () => import('@hierarchidb/basemap-plugin/database'),
  resolver: async () => import('@hierarchidb/resolver-plugin/database'),
  spreadsheet: async () => import('@hierarchidb/spreadsheet-plugin/database'),
  route: async () => import('@hierarchidb/route-plugin/database'),
  shape: async () => import('@hierarchidb/shape-plugin'),
  location: async () => import('@hierarchidb/location-plugin'),
  styler: async () => import('@hierarchidb/styler-plugin'),
  timeline: async () => import('@hierarchidb/timeline-plugin'),
  linker: async () => import('@hierarchidb/linker-plugin'),
};

async function getServices(): Promise<Record<string, Loader>> {
  return loaderMap;
}

type KnownPluginServiceReturnMap = {
  basemap: typeof import('@hierarchidb/basemap-plugin/database') | null;
  resolver: typeof import('@hierarchidb/resolver-plugin/database') | null;
  spreadsheet: typeof import('@hierarchidb/spreadsheet-plugin/database') | null;
  route: typeof import('@hierarchidb/route-plugin/database') | null;
  shape: typeof import('@hierarchidb/shape-plugin') | null;
  location: typeof import('@hierarchidb/location-plugin') | null;
  styler: typeof import('@hierarchidb/styler-plugin') | null;
  timeline: typeof import('@hierarchidb/timeline-plugin') | null;
  linker: typeof import('@hierarchidb/linker-plugin') | null;
};

type KnownPluginNodeType = keyof KnownPluginServiceReturnMap;

type LoadPluginServiceResult<N extends string> =
  N extends KnownPluginNodeType ? KnownPluginServiceReturnMap[N] : (unknown | null);

export async function loadPluginService<N extends string>(nodeType: N): Promise<LoadPluginServiceResult<N>> {
  const services = await getServices();
  const loader = services[nodeType];
  if (typeof loader !== 'function') return null as LoadPluginServiceResult<N>;
  try {
    const mod = await loader();
    return resolveModule(mod) as LoadPluginServiceResult<N>;
  } catch (error) {
    return null as LoadPluginServiceResult<N>;
  }
}

function resolveModule<T>(moduleValue: unknown): T | null {
  if (moduleValue == null) return null;
  if (typeof moduleValue === 'object' && moduleValue !== null) {
    const record = moduleValue as Record<string, unknown>;
    if ('default' in record && record.default !== undefined) {
      return record.default as T;
    }
  }
  return moduleValue as T;
}

export async function tryLoadFirst<T = unknown>(nodeTypes: string[]): Promise<T | null> {
  for (const nt of nodeTypes) {
    const moduleValue = await loadPluginService(nt);
    if (moduleValue) return moduleValue as T;
  }
  return null;
}
