import type {
  PluginDefinition,
  PluginModuleInfo,
  PluginModuleSet,
  PluginManifest,
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
    database: entry.manifest?.database
      ? {
          dbName: entry.manifest.database.dbName,
          tableName: entry.manifest.database.tableName,
          version: entry.manifest.database.version,
          schema: entry.manifest.database.schema,
        }
      : undefined,
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

export type StepTitleDescriptor = {
  namespace: string;
  key: string;
  stepKey: string;
  kind: 'common' | 'plugin';
};

export type StepTitleTranslator = (namespace: string, key: string) => string;

const BASIC_INFO_STEP_KEY = 'basicInfo';
const BASIC_INFO_NAMESPACE = 'common';
const BASIC_INFO_I18N_KEY = 'basicInfo.title';

const normalizeStepNumber = (step: number): number | null => {
  if (!Number.isFinite(step)) return null;
  const normalized = Math.trunc(step);
  if (normalized <= 0) return null;
  return normalized;
};

const resolveStepKey = (
  manifest: PluginManifest | null | undefined,
  step: number
): string | null => {
  const normalized = normalizeStepNumber(step);
  if (!normalized) return null;
  const mapping = manifest?.stepTitleKeys ?? null;
  if (!mapping) return null;
  const entry = mapping[String(normalized)];
  return typeof entry === 'string' && entry.trim().length > 0 ? entry : null;
};

export function resolveStepTitleDescriptor(
  manifest: PluginManifest | null | undefined,
  step: number
): StepTitleDescriptor | null {
  const stepKey = resolveStepKey(manifest, step);
  if (!stepKey) return null;
  if (stepKey === BASIC_INFO_STEP_KEY) {
    return {
      namespace: BASIC_INFO_NAMESPACE,
      key: BASIC_INFO_I18N_KEY,
      stepKey,
      kind: 'common',
    };
  }
  const namespace = manifest?.i18nNamespace;
  if (!namespace) return null;
  return {
    namespace,
    key: `steps.${stepKey}.label`,
    stepKey,
    kind: 'plugin',
  };
}

export function resolveStepTitleForEntry(
  entry: PluginRegistryEntry | null | undefined,
  step: number
): StepTitleDescriptor | null {
  return resolveStepTitleDescriptor(entry?.manifest ?? null, step);
}

export function resolveStepTitle(
  manifest: PluginManifest | null | undefined,
  step: number,
  translate: StepTitleTranslator
): string | null {
  const descriptor = resolveStepTitleDescriptor(manifest, step);
  if (!descriptor) return null;
  return translate(descriptor.namespace, descriptor.key);
}

export function resolveStepTitleFromRegistry(
  registry: readonly PluginRegistryEntry[],
  nodeType: string,
  step: number,
  translate: StepTitleTranslator
): string | null {
  const entry = registry.find((item) => item.nodeType === nodeType);
  if (!entry) return null;
  return resolveStepTitle(entry.manifest ?? null, step, translate);
}
