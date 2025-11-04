import type { NodeType } from '@hierarchidb/feature-core/common-types';
import type {
  PluginCategoryConfig,
  PluginIconConfig,
  PluginManifest,
  PluginRegistryEntry,
} from '@hierarchidb/feature-core/plugin-registry/types';
import appPackageJson from '../../package.json' with { type: 'json' };
import { pluginRegistry } from '../plugin-registry/index.ts';

interface PackageJsonShape {
  dependencies?: Record<string, unknown>;
  devDependencies?: Record<string, unknown>;
  optionalDependencies?: Record<string, unknown>;
}

export interface InstalledPlugin {
  nodeType: NodeType;
  packageName: string;
  version: string | null;
  manifest: PluginManifest | null;
  hasUI: boolean;
  hasWorker: boolean;
  hasCommon: boolean;
  hasDatabase: boolean;
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
  categoryId?: string;
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

function createSignature(entries: PluginRegistryEntry[]): string {
  try {
    return JSON.stringify(
      entries.map((entry) => ({
        nodeType: entry.nodeType,
        version: entry.version,
        manifest: entry.manifest,
      }))
    );
  } catch {
    return '';
  }
}

function computeInstalledPlugins(): InstalledPlugin[] {
  const rawEntries = pluginRegistry as PluginRegistryEntry[];
  const allowedPackages = collectPluginDependencyNames(appPackageJson as PackageJsonShape);
  const filtered =
    allowedPackages.size > 0
      ? rawEntries.filter((entry) => allowedPackages.has(entry.packageName))
      : rawEntries;

  const plugins = filtered.map((entry) => {
    const manifest = entry.manifest ?? null;
    const iconConfig: PluginIconConfig | undefined = manifest?.icon ?? undefined;
    const label = sanitizeLabel(
      manifest?.displayName ?? manifest?.name,
      manifest?.nodeType ?? entry.nodeType
    );
    const iconColor =
      typeof iconConfig?.color === 'string' && iconConfig.color.trim().length > 0
        ? iconConfig.color
        : undefined;
    const backgroundColor = iconColor
      ? (withAlpha(iconColor, '22') ?? iconColor)
      : 'rgba(0,0,0,0.08)';
    const dependencies = entry.dependencies;
    const category: PluginCategoryConfig | undefined = manifest?.category ?? undefined;
    const categoryObject = category && typeof category === 'object' ? category : null;
    const menuGroup =
      categoryObject?.menuGroup ??
      (typeof category === 'string' && category.trim().length > 0 ? category : 'core');
    const createOrder =
      typeof categoryObject?.createOrder === 'number'
        ? categoryObject.createOrder
        : Number.isFinite(manifest?.priority)
          ? Number(manifest?.priority)
          : 1000;
    const treeContext = categoryObject?.treeId ?? '*';

    const hasUI = Boolean(entry.modules.ui?.specifier);
    const hasWorker = Boolean(entry.modules.worker?.specifier);
    const hasCommon = Boolean(entry.modules.common?.specifier);
    const hasDatabase = Boolean(entry.modules.database?.specifier);

    return {
      nodeType: entry.nodeType as NodeType,
      packageName: entry.packageName,
      version: entry.version,
      manifest,
      hasUI,
      hasWorker,
      hasCommon,
      hasDatabase,
      label,
      icon: {
        muiIconName: iconConfig?.muiIconName ?? iconConfig?.mui ?? undefined,
        emoji: iconConfig?.emoji ?? undefined,
        color: iconColor,
      },
      iconColor,
      backgroundColor: backgroundColor ?? 'rgba(0,0,0,0.08)',
      description: manifest?.description ?? '',
      dependencies,
      menuGroup,
      createOrder,
      treeContext,
      categoryId: categoryObject?.id ?? (typeof category === 'string' ? category : undefined),
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
  const rawEntries = pluginRegistry as PluginRegistryEntry[];
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

export function getNodeTypesByMenuGroup(menuGroup: string): NodeType[] {
  return getInstalledPlugins()
    .filter((plugin) => plugin.menuGroup === menuGroup)
    .map((plugin) => plugin.nodeType);
}

export function getNodeTypesByCategoryId(categoryId: string): NodeType[] {
  return getInstalledPlugins()
    .filter((plugin) => plugin.categoryId === categoryId)
    .map((plugin) => plugin.nodeType);
}

export function getAllPluginNodeTypes(): NodeType[] {
  return getInstalledPlugins().map((plugin) => plugin.nodeType);
}

export function orderNodeTypes(nodeTypes: Iterable<string>): NodeType[] {
  const pluginMap = getInstalledPluginMap();
  const seen = new Set<string>();
  const list: Array<{ nodeType: NodeType; order: number; label: string }> = [];
  for (const nodeType of nodeTypes) {
    if (typeof nodeType !== 'string') continue;
    if (seen.has(nodeType)) continue;
    seen.add(nodeType);
    const plugin = pluginMap.get(nodeType);
    if (!plugin) continue;
    list.push({ nodeType: plugin.nodeType, order: plugin.createOrder, label: plugin.label });
  }
  list.sort((a, b) => {
    if (a.order !== b.order) {
      return a.order - b.order;
    }
    return a.label.localeCompare(b.label);
  });
  return list.map((item) => item.nodeType);
}
