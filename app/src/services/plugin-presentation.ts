/**
 * Where: app/src/services/plugin-presentation.ts
 * What: Resolve presentation metadata (label/icon/color) for plugin-loader exposed in the UI.
 * Why: SpeedDial and other menus must render icons straight from package metadata instead of placeholders.
 */

import { prefetchMuiIcons } from '@hierarchidb/ui-icon';
import { getInstalledPlugins, type InstalledPlugin } from './plugin-registry.js';

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

const ICON_NAME_NORMALIZATION_MAP: Record<string, string> = {
  LocationPin: 'LocationOn',
  Location: 'LocationOn',
  MapMarker: 'Place',
};

let presentationCache: Map<string, PluginPresentation> | null = null;
let presentationSignature: string | null = null;

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

function buildPresentation(def: InstalledPlugin): PluginPresentation {
  const iconConfig = def.icon ?? {};
  const fallbackLabel = def.label || def.nodeType;
  const label = sanitizeLabel(def.label, fallbackLabel);
  const priorityCandidate = def.manifest?.priority ?? def.createOrder;
  const muiIconName = normalizeMuiIconName(iconConfig.muiIconName);
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

function createSignature(defs: InstalledPlugin[]): string {
  try {
    const parts = defs.map((def) => {
      return [
        def.nodeType,
        def.label ?? '',
        def.icon?.muiIconName ?? '',
        def.icon?.color ?? '',
        def.manifest?.priority ?? '',
        def.createOrder ?? '',
      ];
    });
    return JSON.stringify(parts);
  } catch {
    return '';
  }
}

function ensureCache(): Map<string, PluginPresentation> {
  const defs = getInstalledPlugins();
  const signature = createSignature(defs);
  if (!presentationCache || presentationSignature !== signature) {
    const map = new Map<string, PluginPresentation>();
    for (const def of defs) {
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
