/**
 * Where: app/src/services/plugin-presentation.ts
 * What: Resolve presentation metadata (label/icon/color) for plugin-loader exposed in the UI.
 * Why: SpeedDial and other menus must render icons straight from package metadata instead of placeholders.
 */

import { prefetchMuiIcons } from '@hierarchidb/ui-icon';
import pluginDefinitions from 'virtual:plugin-definitions';

export interface PluginIconInfo {
  muiIconName?: string;
  emoji?: string;
  color?: string;
}

export interface PluginPresentation {
  nodeType: string;
  label: string;
  icon: PluginIconInfo;
  priority: number;
}

interface PluginDefinition {
  nodeType: string;
  name?: string;
  version?: string;
  priority?: number;
  config?: {
    name?: string;
    displayName?: string;
    priority?: number;
    icon?: {
      mui?: string;
      muiIconName?: string;
      emoji?: string;
      color?: string;
    };
  };
}

const ICON_NAME_NORMALIZATION_MAP: Record<string, string> = {
  LocationPin: 'LocationOn',
  Location: 'LocationOn',
  MapMarker: 'Place',
};

let presentationCache: Map<string, PluginPresentation> | null = null;
let presentationSignature: string | null = null;

function isPluginDefinition(value: unknown): value is PluginDefinition {
  return Boolean(value) && typeof value === 'object' && typeof (value as PluginDefinition).nodeType === 'string';
}

function getDefinitions(): PluginDefinition[] {
  const globalDefs = (globalThis as { __HDB_PLUGIN_DEFS__?: unknown }).__HDB_PLUGIN_DEFS__;
  if (Array.isArray(globalDefs) && globalDefs.every(isPluginDefinition)) {
    return globalDefs as PluginDefinition[];
  }
  if (Array.isArray(pluginDefinitions) && pluginDefinitions.every(isPluginDefinition)) {
    return pluginDefinitions as PluginDefinition[];
  }
  return [];
}

function normalizeMuiIconName(name?: string): string | undefined {
  if (!name) return undefined;
  return ICON_NAME_NORMALIZATION_MAP[name] || name;
}

function sanitizeLabel(source: unknown, fallback: string): string {
  if (typeof source !== 'string' || source.trim().length === 0) {
    return fallback;
  }
  return source.replace(/\s+Plugin$/i, '').trim();
}

function buildPresentation(def: PluginDefinition): PluginPresentation {
  const cfg = def.config ?? {};
  const iconConfig = cfg.icon ?? {};
  const fallbackLabel = def.name || def.nodeType;
  const label = sanitizeLabel(cfg.displayName ?? cfg.name, fallbackLabel);
  const priorityCandidate = typeof cfg.priority === 'number' ? cfg.priority : def.priority;
  const muiIconName = normalizeMuiIconName(iconConfig.muiIconName ?? iconConfig.mui);

  return {
    nodeType: def.nodeType,
    label,
    icon: {
      muiIconName: muiIconName ?? (def.nodeType === 'folder' ? 'Folder' : 'Extension'),
      emoji: typeof iconConfig.emoji === 'string' ? iconConfig.emoji : undefined,
      color: typeof iconConfig.color === 'string' ? iconConfig.color : undefined,
    },
    priority: typeof priorityCandidate === 'number' ? priorityCandidate : 1000,
  };
}

function createSignature(defs: PluginDefinition[]): string {
  try {
    const parts = defs.map((def) => {
      const cfg = def.config ?? {};
      const icon = cfg.icon ?? {};
      return [
        def.nodeType,
        cfg.displayName ?? cfg.name ?? def.name ?? '',
        icon.mui ?? icon.muiIconName ?? '',
        icon.color ?? '',
        cfg.priority ?? '',
        def.priority ?? '',
      ];
    });
    return JSON.stringify(parts);
  } catch {
    return '';
  }
}

function ensureCache(): Map<string, PluginPresentation> {
  const defs = getDefinitions();
  const signature = createSignature(defs);
  if (!presentationCache || presentationSignature !== signature) {
    const map = new Map<string, PluginPresentation>();
    for (const def of defs) {
      if (!isPluginDefinition(def)) continue;
      const presentation = buildPresentation(def);
      map.set(presentation.nodeType, presentation);
    }
    presentationCache = map;
    presentationSignature = signature;
  }
  return presentationCache;
}

export function getPresentation(nodeType: string): PluginPresentation | undefined {
  const cache = ensureCache();
  if (cache.size === 0) {
    return undefined;
  }
  const normalized = typeof nodeType === 'string' ? nodeType : '';
  return cache.get(normalized);
}

export async function prefetchAllIcons(): Promise<void> {
  const cache = ensureCache();
  if (cache.size === 0) return;
  const iconNames = Array.from(cache.values())
    .map((item) => item.icon.muiIconName)
    .filter((name, index, self): name is string => typeof name === 'string' && name.trim().length > 0 && self.indexOf(name) === index);
  if (iconNames.length === 0) return;
  await prefetchMuiIcons(iconNames);
}

export function resetPluginPresentationCacheForTests(): void {
  presentationCache = null;
  presentationSignature = null;
}
