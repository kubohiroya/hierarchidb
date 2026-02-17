/**
 * Registry for standardized worker-side runtime-worker exports discovered from plugin-loader.
 *
 * Stores factories and lifecycle objects per nodeType so the worker entry can
 * merge them into PluginDefinition metadata passed to WorkerService.
 */

export type RuntimeFactories = {
  createEntityHandler?: () => Promise<unknown> | unknown;
  createBuildManager?: () => Promise<unknown> | unknown;
};

export type RuntimeExports = RuntimeFactories & {
  lifecycle?: Record<string, unknown>;
};

const registry = new Map<string, RuntimeExports>();

export function registerRuntimeExports(nodeType: string, exp: RuntimeExports): void {
  const cur = registry.get(nodeType) || {};
  registry.set(nodeType, { ...cur, ...exp });
}

export function getRuntimeExports(nodeType: string): RuntimeExports | undefined {
  return registry.get(nodeType);
}

export function getAllRuntimeExports(): Record<string, RuntimeExports> {
  const out: Record<string, RuntimeExports> = {};
  for (const [k, v] of registry.entries()) out[k] = v;
  return out;
}

export function clearRuntimeExportsForTests(): void {
  registry.clear();
}
