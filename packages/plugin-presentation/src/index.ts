import type { ReactNode } from 'react';
import * as UIIcon from '@hierarchidb/ui-icon';
import type {
  PluginPresentationDefinition,
  PluginPresentation,
  PluginPresentationIconConfig,
  PluginPresentationManifest,
} from './types.js';

const ICON_NAME_NORMALIZATION_MAP: Record<string, string> = {
  LocationPin: 'LocationOn',
  Location: 'LocationOn',
  MapMarker: 'Place',
};

const FALLBACK_ICONS: Record<string, PluginPresentationIconConfig> = {
  basemap: { muiIconName: 'Public', emoji: '🌍', color: '#b0b3d9' },
  linker: { muiIconName: 'AccountTree', emoji: '🌲', color: '#ffe0f3' },
  resolver: { muiIconName: 'Extension', emoji: '🧩', color: '#ffb3c1' },
  timeline: { muiIconName: 'AccessTime', emoji: '🕒', color: '#8a7cbf' },
};

let activeDefinitions: PluginPresentationDefinition[] | null = null;
let presentationCache: Map<string, PluginPresentation> | null = null;
let presentationSignature: string | null = null;

function normalizeMuiIconName(name?: string): string | undefined {
  if (!name) return undefined;
  return ICON_NAME_NORMALIZATION_MAP[name] ?? name;
}

function toPascalCase(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const parts = value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  if (parts.length === 0) return undefined;
  return parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}

function normalizeLabelText(raw: string): string {
  if (!raw) return raw;
  const collapsed = raw.replace(/\s+Plugin$/i, '').trim();
  if (!collapsed) return collapsed;
  const lower = collapsed.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function sanitizeLabel(source: unknown, fallback: string): string {
  if (typeof source !== 'string' || source.trim().length === 0) {
    const trimmedFallback = fallback.trim();
    return trimmedFallback.length > 0 ? normalizeLabelText(trimmedFallback) : trimmedFallback;
  }
  const normalized = normalizeLabelText(source);
  if (normalized.length > 0) return normalized;
  const fallbackNormalized = normalizeLabelText(fallback);
  return fallbackNormalized.length > 0 ? fallbackNormalized : fallback.trim();
}

function buildPresentation(def: PluginPresentationDefinition): PluginPresentation {
  const iconConfig = def.icon ?? {};
  const manifest: PluginPresentationManifest | null | undefined = def.manifest;
  const fallbackLabel = def.label ?? def.nodeType;
  const label = sanitizeLabel(def.label, fallbackLabel);
  const priorityCandidate = manifest?.priority ?? def.createOrder;
  const manifestIcon = manifest?.icon ?? null;
  const hasComponent = Boolean(manifestIcon?.component?.specifier);
  const rawIconName = iconConfig.muiIconName ?? manifestIcon?.muiIconName ?? manifestIcon?.mui;
  const normalizedIconName = normalizeMuiIconName(rawIconName);
  const componentIconName = hasComponent ? toPascalCase(String(def.nodeType)) : undefined;
  const fallbackIcon = FALLBACK_ICONS[def.nodeType] ?? {};
  const description = typeof manifest?.description === 'string' ? manifest.description.trim() : undefined;

  return {
    nodeType: def.nodeType,
    label,
    icon: {
      muiIconName:
        normalizedIconName
        ?? componentIconName
        ?? fallbackIcon.muiIconName
        ?? (def.nodeType === 'folder' ? 'Folder' : 'Extension'),
      emoji: typeof iconConfig.emoji === 'string'
        ? iconConfig.emoji
        : manifestIcon?.emoji ?? fallbackIcon.emoji,
      color: typeof iconConfig.color === 'string'
        ? iconConfig.color
        : manifestIcon?.color ?? fallbackIcon.color,
    },
    priority: typeof priorityCandidate === 'number' ? priorityCandidate : 1000,
    description: description && description.length > 0 ? description : undefined,
  };
}

function createSignature(defs: PluginPresentationDefinition[]): string {
  try {
    const parts = defs.map((def) => [
      def.nodeType,
      def.label ?? '',
      def.icon?.muiIconName ?? '',
      def.icon?.color ?? '',
      def.manifest?.description ?? '',
      def.manifest?.priority ?? '',
      def.createOrder ?? '',
    ]);
    return JSON.stringify(parts);
  } catch {
    return '';
  }
}

function readGlobalPluginDefinitions(): PluginPresentationDefinition[] {
  const g = (typeof globalThis !== 'undefined' ? globalThis : ({} as unknown)) as {
    __HDB_PLUGIN_DEFS__?: PluginPresentationDefinition[];
  };
  const defs = g.__HDB_PLUGIN_DEFS__;
  return Array.isArray(defs) ? defs : [];
}

function getDefinitions(): PluginPresentationDefinition[] {
  if (activeDefinitions) {
    return activeDefinitions;
  }
  const globalDefs = readGlobalPluginDefinitions();
  if (globalDefs.length > 0) {
    activeDefinitions = globalDefs.slice();
    return activeDefinitions;
  }
  return [];
}

function ensureCache(): Map<string, PluginPresentation> {
  const defs = getDefinitions();
  const signature = createSignature(defs);
  if (presentationCache && signature === presentationSignature) {
    return presentationCache;
  }
  const map = new Map<string, PluginPresentation>();
  for (const def of defs) {
    map.set(def.nodeType, buildPresentation(def));
  }
  presentationCache = map;
  presentationSignature = signature;
  return map;
}

export function setPluginPresentationDefinitions(defs: PluginPresentationDefinition[]): void {
  activeDefinitions = Array.isArray(defs) ? defs.map((def) => ({ ...def })) : [];
  presentationCache = null;
  presentationSignature = null;
}

export function registerGlobalPluginDefinitions(defs: PluginPresentationDefinition[]): void {
  const g = (typeof globalThis !== 'undefined' ? globalThis : ({} as unknown)) as {
    __HDB_PLUGIN_DEFS__?: PluginPresentationDefinition[];
  };
  g.__HDB_PLUGIN_DEFS__ = Array.isArray(defs) ? defs.map((def) => ({ ...def })) : [];
  setPluginPresentationDefinitions(g.__HDB_PLUGIN_DEFS__ ?? []);
}

export function hydratePresentationDefinitionsFromGlobal(): void {
  const defs = readGlobalPluginDefinitions();
  if (defs.length > 0) {
    setPluginPresentationDefinitions(defs);
  }
}

export function getPresentation(nodeType: string): PluginPresentation | undefined {
  const cache = ensureCache();
  if (cache.size === 0) return undefined;
  return cache.get(nodeType);
}

export function getPresentations(): PluginPresentation[] {
  return Array.from(ensureCache().values());
}

export async function prefetchAllIcons(): Promise<void> {
  const cache = ensureCache();
  if (cache.size === 0) return;
  const iconNames = Array.from(cache.values())
    .map((item) => item.icon.muiIconName)
    .filter((name, index, self): name is string => typeof name === 'string' && name.trim().length > 0 && self.indexOf(name) === index);
  if (iconNames.length === 0) return;
  await UIIcon.prefetchMuiIcons?.(iconNames);
}

export function getIconComponent(nodeType: string): ReactNode | undefined {
  const presentation = getPresentation(nodeType);
  if (!presentation) {
    return UIIcon.getMuiIconComponent?.('Extension');
  }
  const icon = presentation.icon;
  try {
    const Comp = UIIcon.getMuiIconComponent?.(icon.muiIconName, icon.emoji);
    if (Comp) return Comp;
  } catch (error) {
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
      console.warn('[plugin-presentation] getMuiIconComponent failed', error);
    }
  }
  return UIIcon.getMuiIconComponent?.('Extension');
}

export function resetPluginPresentationCache(): void {
  presentationCache = null;
}

export function resetPluginPresentationCacheForTests(): void {
  activeDefinitions = null;
  presentationCache = null;
  presentationSignature = null;
}

export type {
  PluginPresentationDefinition,
  PluginPresentation,
  PluginPresentationIconConfig,
  PluginPresentationManifest,
} from './types.js';
