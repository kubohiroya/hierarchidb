import type { PluginMetadata } from '@hierarchidb/common-types';
import appPackage from '../../package.json' assert { type: 'json' };
import pluginMeta from 'virtual:plugin-node-types/meta';

interface RawRegistryEntry {
  nodeType: string;
  packageName: string;
  version: string | null;
  hasUI: boolean;
  hasWorker: boolean;
  hasServices: boolean;
  hasCommon: boolean;
  fallbackServiceImport: string;
  manifest: PluginMetadata | null;
}

interface PackageJsonShape {
  dependencies?: Record<string, unknown>;
  devDependencies?: Record<string, unknown>;
  optionalDependencies?: Record<string, unknown>;
}

export interface InstalledPlugin {
  nodeType: string;
  packageName: string;
  version: string | null;
  manifest: PluginMetadata | null;
  hasUI: boolean;
  hasWorker: boolean;
  hasServices: boolean;
  hasCommon: boolean;
  fallbackServiceImport: string;
  label: string;
  icon: {
    muiIconName?: string;
    emoji?: string;
    color?: string;
  };
  iconColor?: string;
  backgroundColor: string;
  description: string;
  dependencies: string[];
  menuGroup: string;
  createOrder: number;
  treeContext: string;
}

let installedPluginsCache: InstalledPlugin[] | null = null;
let cacheSignature: string | null = null;

function collectPluginDependencyNames(pkg: PackageJsonShape): Set<string> {
  const set = new Set<string>();
  const merge = (record: Record<string, unknown> | undefined) => {
    if (!record) return;
    for (const name of Object.keys(record)) {
      if (/^@hierarchidb\/.*-plugin$/.test(name)) {
        set.add(name);
      }
    }
  };
  merge(pkg.dependencies);
  merge(pkg.devDependencies);
  merge(pkg.optionalDependencies);
  return set;
}

function sanitizeLabel(source: string | undefined, fallback: string): string {
  if (!source || source.trim().length === 0) return fallback;
  return source.replace(/\s+Plugin$/i, '').trim();
}

function withAlpha(hex: string | undefined, alpha: string): string | undefined {
  if (!hex) return undefined;
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
    return `${hex}${alpha}`;
  }
  return hex;
}

function createSignature(entries: RawRegistryEntry[]): string {
  try {
    return JSON.stringify(entries.map((entry) => ({
      nodeType: entry.nodeType,
      version: entry.version,
      manifest: entry.manifest,
    })));
  } catch {
    return '';
  }
}

function computeInstalledPlugins(): InstalledPlugin[] {
  const rawEntries = (pluginMeta as RawRegistryEntry[]) ?? [];
  const allowedPackages = collectPluginDependencyNames(appPackage as PackageJsonShape);
  const filtered = allowedPackages.size > 0
    ? rawEntries.filter((entry) => allowedPackages.has(entry.packageName))
    : rawEntries;

  const plugins = filtered.map((entry) => {
    const manifest = entry.manifest ?? null;
    const iconConfig = manifest?.icon ?? {};
    const label = sanitizeLabel(
      manifest?.displayName ?? manifest?.name,
      manifest?.nodeType ?? entry.nodeType,
    );
    const iconColor = typeof iconConfig.color === 'string' && iconConfig.color.trim().length > 0
      ? iconConfig.color
      : undefined;
    const backgroundColor = iconColor
      ? withAlpha(iconColor, '22') ?? iconColor
      : 'rgba(0,0,0,0.08)';
    const dependencies = Array.isArray(manifest?.dependencies)
      ? (manifest!.dependencies as string[])
      : [];
    const menuGroup = typeof manifest?.category === 'object' && manifest.category
      ? (manifest.category.menuGroup as string | undefined) ?? 'core'
      : 'core';
    const createOrder = typeof manifest?.category === 'object' && manifest.category
      ? Number(manifest.category.createOrder ?? manifest.priority ?? 1000)
      : Number(manifest?.priority ?? 1000);
    const treeContext = typeof manifest?.category === 'object' && manifest.category
      ? (manifest.category.treeId as string | undefined) ?? '*'
      : '*';

    return {
      nodeType: entry.nodeType,
      packageName: entry.packageName,
      version: entry.version,
      manifest,
      hasUI: entry.hasUI,
      hasWorker: entry.hasWorker,
      hasServices: entry.hasServices,
      hasCommon: entry.hasCommon,
      fallbackServiceImport: entry.fallbackServiceImport,
      label,
      icon: {
        muiIconName: iconConfig.muiIconName ?? iconConfig.mui ?? undefined,
        emoji: iconConfig.emoji ?? undefined,
        color: iconColor,
      },
      iconColor,
      backgroundColor: backgroundColor ?? 'rgba(0,0,0,0.08)',
      description: manifest?.description ?? '',
      dependencies,
      menuGroup,
      createOrder,
      treeContext,
    } satisfies InstalledPlugin;
  });

  plugins.sort((a, b) => {
    if (a.createOrder !== b.createOrder) {
      return a.createOrder - b.createOrder;
    }
    return a.label.localeCompare(b.label);
  });

  return plugins;
}

export function getInstalledPlugins(): InstalledPlugin[] {
  const rawEntries = (pluginMeta as RawRegistryEntry[]) ?? [];
  const signature = createSignature(rawEntries);
  if (!installedPluginsCache || cacheSignature !== signature) {
    installedPluginsCache = computeInstalledPlugins();
    cacheSignature = signature;
  }
  return installedPluginsCache;
}

export function getInstalledPluginMap(): Map<string, InstalledPlugin> {
  const map = new Map<string, InstalledPlugin>();
  for (const plugin of getInstalledPlugins()) {
    map.set(plugin.nodeType, plugin);
  }
  return map;
}

export function findInstalledPlugin(nodeType: string): InstalledPlugin | undefined {
  const map = getInstalledPluginMap();
  return map.get(nodeType);
}
