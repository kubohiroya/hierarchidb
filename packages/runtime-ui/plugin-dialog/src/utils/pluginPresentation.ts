// Import as namespace to avoid type-level named export mismatches across package builds
// Note: UIIcon provides getMuiIconComponent/prefetchMuiIcons at runtime
import * as UIIcon from '@hierarchidb/ui-icon';

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
  };
  return map[name] || name;
}

function buildCache(): Map<string, PluginPresentation> {
  if (cache) return cache;
  const map = new Map<string, PluginPresentation>();
  // Avoid async/await here to keep library build simple.
  // If the host app wants to provide plugin definitions, it can set a global at runtime.
  type PluginDef = { nodeType: string; name?: string; config?: { displayName?: string; name?: string; priority?: number; icon?: { mui?: string; muiIconName?: string; emoji?: string; color?: string } } };
  const g = (typeof globalThis !== 'undefined' ? globalThis : ({} as unknown)) as { __HDB_PLUGIN_DEFS__?: PluginDef[] };
  const defs: PluginDef[] = Array.isArray(g.__HDB_PLUGIN_DEFS__) ? (g.__HDB_PLUGIN_DEFS__ as PluginDef[]) : [];

  for (const def of defs) {
    const cfg = def?.config || {};
    const icon = cfg.icon || {};
    const muiIconName = normalizeMuiIconName(icon.mui || icon.muiIconName) || 'Extension';
    let label = cfg.displayName || cfg.name || def?.nodeType || def?.name || 'unknown';
    if (typeof label === 'string') label = label.replace(/\s+Plugin$/i, '');
    map.set(def?.nodeType, {
      nodeType: def?.nodeType,
      label,
      icon: { muiIconName, emoji: icon.emoji, color: icon.color },
      priority: (cfg.priority as number | undefined) ?? 1000,
    });
  }

  cache = map;
  return map;
}

export function getPresentation(nodeType: string): PluginPresentation | undefined {
  return buildCache().get(nodeType);
}

export function getIconComponent(nodeType: string) {
  const icon = getPresentation(nodeType)?.icon;
  try {
    const Comp = (UIIcon as unknown as { getMuiIconComponent?: (name?: string, emoji?: string) => any })
      .getMuiIconComponent?.(icon?.muiIconName, icon?.emoji);
    if (Comp) return Comp;
  } catch (err) {
    console.warn('[pluginPresentation] getMuiIconComponent failed', err);
  }
  return (UIIcon as unknown as { getMuiIconComponent?: (name?: string) => any }).getMuiIconComponent?.('Extension');
}

export async function prefetchAllIcons() {
  try {
    const icons = Array.from(buildCache().values()).map((p) => p.icon.muiIconName);
    await (UIIcon as unknown as { prefetchMuiIcons?: (names: (string | undefined)[]) => Promise<void> }).prefetchMuiIcons?.(icons);
  } catch (err) {
    console.warn('[pluginPresentation] prefetchAllIcons failed', err);
  }
}
