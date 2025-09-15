/**
 * Plugin Presentation Service
 * - Provides label/icon info per nodeType based on package.json (hierarchidb.plugin)
 * - Independent from TreeId/context so it can be reused across UI (dialogs, tables, etc.)
 */

import pluginDefinitions from 'virtual:plugin-definitions';
import { getMuiIconComponent, prefetchMuiIcons } from '@hierarchidb/ui-icon';

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

let cache: Map<string, PluginPresentation> | null = null;

function normalizeMuiIconName(name?: string): string | undefined {
  if (!name) return undefined;
  const map: Record<string, string> = {
    LocationPin: 'LocationOn',
    Location: 'LocationOn',
    MapMarker: 'Place',
    // add more synonyms here if needed
  };
  return map[name] || name;
}

function buildCache(): Map<string, PluginPresentation> {
  if (cache) return cache;
  const map = new Map<string, PluginPresentation>();

  for (const def of (pluginDefinitions || []) as any[]) {
    const cfg = (def?.config || {}) as any;
    const icon = (cfg.icon || {}) as any;
    const muiIconName = normalizeMuiIconName(icon.mui || icon.muiIconName) || 'Extension';
    let label = cfg.displayName || cfg.name || def?.nodeType || def?.name || 'unknown';
    // Normalize common noisy suffixes from package metadata
    if (typeof label === 'string') {
      label = label.replace(/\s+Plugin$/i, '');
    }

    const entry: PluginPresentation = {
      nodeType: def?.nodeType || def?.name || 'unknown',
      label,
      icon: { muiIconName, emoji: icon.emoji, color: icon.color },
      priority: cfg.priority ?? def?.priority ?? 1000,
    };

    map.set(entry.nodeType, entry);
  }

  cache = map;
  return map;
}

export function getAllPresentations(): Map<string, PluginPresentation> {
  return buildCache();
}

export function getPresentation(nodeType: string): PluginPresentation | undefined {
  return buildCache().get(nodeType);
}

export function getIcon(nodeType: string): PluginIconInfo | undefined {
  return getPresentation(nodeType)?.icon;
}

export function getIconComponent(nodeType: string) {
  const icon = getIcon(nodeType);
  const Comp = getMuiIconComponent(icon?.muiIconName, icon?.emoji);
  if (Comp) return Comp;
  // Fallback to a safe default icon
  return getMuiIconComponent('Extension');
}

export async function prefetchAllIcons() {
  const icons = Array.from(buildCache().values()).map((p) => p.icon.muiIconName);
  await prefetchMuiIcons(icons);
}
