// Thin facade over virtual:plugin-registry-services
// Provides a stable way to resolve optional per-plugin services/DB modules.
// NOTE: Avoid top-level import of the virtual module to prevent early boot races.
//       Lazy-load on first use instead.

type Loader = () => Promise<unknown>;

let _servicesMap: Record<string, Loader> | null = null;
async function getServices(): Promise<Record<string, Loader>> {
  if (_servicesMap) return _servicesMap;
  try {
    const mod: any = await import('virtual:plugin-registry-services');
    _servicesMap = (mod?.pluginServices || {}) as Record<string, Loader>;
  } catch (e) {
    // During dev server warm-up the virtual module may not be ready yet.
    // Return empty map; callers will receive null and can retry on demand.
    _servicesMap = {};
  }
  return _servicesMap;
}

// Overloads for known services to provide strong typing without `as any`
export async function loadPluginService(nodeType: 'basemap'): Promise<typeof import('@hierarchidb/basemap-plugin/database') | null>;
export async function loadPluginService(nodeType: 'resolver'): Promise<typeof import('@hierarchidb/resolver-plugin/database') | null>;
export async function loadPluginService(nodeType: 'spreadsheet'): Promise<typeof import('@hierarchidb/spreadsheet-plugin/database') | null>;
export async function loadPluginService(nodeType: 'route'): Promise<typeof import('@hierarchidb/route-plugin/database') | null>;
export async function loadPluginService(nodeType: 'shape'): Promise<typeof import('@hierarchidb/shape-plugin/services') | null>;
export async function loadPluginService(nodeType: 'location'): Promise<typeof import('@hierarchidb/location-plugin/services') | null>;
export async function loadPluginService(nodeType: 'styler'): Promise<typeof import('@hierarchidb/styler-plugin/services') | null>;
export async function loadPluginService(nodeType: 'timeline'): Promise<typeof import('@hierarchidb/timeline-plugin/services') | null>;
export async function loadPluginService(nodeType: 'linker'): Promise<typeof import('@hierarchidb/linker-plugin/services') | null>;
// For other plugins, fall back to generic typing
export async function loadPluginService<T = unknown>(nodeType: string): Promise<T | null>;
export async function loadPluginService<T = unknown>(nodeType: string): Promise<T | null> {
  const services = await getServices();
  const loader: Loader | undefined = services[nodeType];
  if (typeof loader !== 'function') return null;
  try {
    const mod = await loader();
    // Prefer default export when present; otherwise return the module object
    return (mod as any)?.default ?? (mod as unknown as T);
  } catch {
    return null;
  }
}

export async function tryLoadFirst<T = unknown>(nodeTypes: string[]): Promise<T | null> {
  for (const nt of nodeTypes) {
    const m = await loadPluginService<T>(nt);
    if (m) return m;
  }
  return null;
}
