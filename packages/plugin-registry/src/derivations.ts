import type {
  PluginDefinition,
  PluginModuleInfo,
  PluginModuleSet,
  PluginRegistryEntry,
} from './types.ts';

export type PluginModuleKey = keyof PluginModuleSet;

function toDisplayName(entry: PluginRegistryEntry): string {
  return entry.manifest?.displayName ?? entry.manifest?.name ?? capitalize(entry.nodeType);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function hasSpecifier(moduleInfo: PluginModuleInfo | undefined): moduleInfo is PluginModuleInfo {
  return Boolean(moduleInfo?.specifier);
}

export function derivePluginDefinitions(
  registry: readonly PluginRegistryEntry[],
): PluginDefinition[] {
  return registry.map((entry) => ({
    nodeType: entry.nodeType,
    name: entry.manifest?.name ?? entry.packageName,
    packageName: entry.packageName,
    version: entry.manifest?.version ?? entry.version,
    displayName: toDisplayName(entry),
    priority:
      typeof entry.manifest?.priority === 'number' && Number.isFinite(entry.manifest.priority)
        ? entry.manifest.priority
        : 0,
    dependencies: entry.dependencies,
  }));
}

export function derivePluginModuleSpecifiers(
  registry: readonly PluginRegistryEntry[],
  moduleKey: PluginModuleKey,
): Record<string, string> {
  const pairs: Array<[string, string]> = [];
  for (const entry of registry) {
    const moduleInfo = entry.modules[moduleKey];
    if (hasSpecifier(moduleInfo)) {
      pairs.push([entry.nodeType, moduleInfo.specifier]);
    }
  }
  return Object.fromEntries(pairs);
}

export function derivePluginModuleSources(
  registry: readonly PluginRegistryEntry[],
  moduleKey: PluginModuleKey,
): Record<string, string | undefined> {
  const pairs: Array<[string, string | undefined]> = [];
  for (const entry of registry) {
    const moduleInfo = entry.modules[moduleKey];
    if (hasSpecifier(moduleInfo)) {
      pairs.push([entry.nodeType, moduleInfo.source]);
    }
  }
  return Object.fromEntries(pairs);
}

