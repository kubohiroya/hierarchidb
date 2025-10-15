// Thin facade over virtual:plugin-node-types/services (互換として virtual:plugin-registry-services も提供)
// Provides a stable way to resolve optional per-plugin services/DB modules.
// NOTE: Avoid top-level import of the virtual module to prevent early boot races.
//       Lazy-load on first use instead.

type Loader = () => Promise<unknown>;

let _servicesMap: Record<string, Loader> | null = null;
async function getServices(): Promise<Record<string, Loader>> {
  if (_servicesMap) return _servicesMap;
  try {
    const mod = await import('virtual:plugin-registry-services');
    _servicesMap = mod.pluginServices ?? {};
  } catch (error) {
    // During dev server warm-up the virtual module may not be ready yet.
    // Return empty map; callers will receive null and can retry on demand.
    _servicesMap = {};
  }
  return _servicesMap;
}

type KnownPluginServiceReturnMap = {
  basemap: typeof import('@hierarchidb/basemap-plugin/database') | null;
  resolver: typeof import('@hierarchidb/resolver-plugin/database') | null;
  spreadsheet: typeof import('@hierarchidb/spreadsheet-plugin/database') | null;
  route: typeof import('@hierarchidb/route-plugin/database') | null;
  shape: typeof import('@hierarchidb/shape-plugin/services') | null;
  location: typeof import('@hierarchidb/location-plugin/services') | null;
  styler: typeof import('@hierarchidb/styler-plugin/services') | null;
  timeline: typeof import('@hierarchidb/timeline-plugin/services') | null;
  linker: typeof import('@hierarchidb/linker-plugin/services') | null;
};

type KnownPluginNodeType = keyof KnownPluginServiceReturnMap;

type LoadPluginServiceResult<N extends string> =
  N extends KnownPluginNodeType ? KnownPluginServiceReturnMap[N] : (unknown | null);

export async function loadPluginService<N extends string>(nodeType: N): Promise<LoadPluginServiceResult<N>> {
  const services = await getServices();
  const loader: Loader | undefined = services[nodeType];
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
