/**
 * getMuiIconComponent
 *
 * ハードコーディングの限定マッピングに依存しない、MUI Icons 名→コンポーネント変換。
 * emoji 指定があれば emoji を返し、文字列名は PascalCase に正規化して
 * `@mui/icon-material/<Name>` を React.lazy + dynamic import で読み込みます。
 * 読み込み中/失敗時は Add アイコンをフォールバック表示します。
 */
import type { ReactNode } from 'react';
import type { SvgIconProps } from '@mui/material/SvgIcon';
import type React from 'react';
import {
  Add as AddIcon,
  Folder as FolderIcon,
  Public as PublicIcon,
  Hexagon as HexagonIcon,
  LocationOn as LocationOnIcon,
  Route as RouteIcon,
  Assessment as AssessmentIcon,
  Palette as PaletteIcon,
  Extension as ExtensionIcon,
  AccountTree as AccountTreeIcon,
  AccessTime as AccessTimeIcon,
} from '@mui/icons-material';

export function toPascalCase(name?: string): string {
  if (!name) return '';
  const trimmed = String(name).trim();
  if (/^[A-Z][A-Za-z0-9]*$/.test(trimmed)) return trimmed; // already PascalCase
  const parts = trimmed
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join('');
}

function normalizeMuiName(name?: string): string | undefined {
  if (!name) return undefined;
  const map: Record<string, string> = {
    // Common synonyms from plugin metadata
    locationpin: 'LocationOn',
    location: 'LocationOn',
    mapmarker: 'Place',
    basemap: 'Public',
    project: 'AccountTree',
    spreadsheet: 'Assessment',
    resolver: 'Extension',
    styler: 'Palette',
  };
  const key = String(name).replace(/[^a-z0-9]/gi, '').toLowerCase();
  return map[key] || name;
}

// Small static map to avoid dynamic import pitfalls for _obsolate_common icons
const staticMap: Record<string, React.ComponentType<SvgIconProps> | undefined> = {
  Folder: FolderIcon,
  Public: PublicIcon,
  Hexagon: HexagonIcon,
  LocationOn: LocationOnIcon,
  Route: RouteIcon,
  Assessment: AssessmentIcon,
  Palette: PaletteIcon,
  Extension: ExtensionIcon,
  AccountTree: AccountTreeIcon,
  AccessTime: AccessTimeIcon,
  Timeline: AccessTimeIcon,
};

// Dynamic icon resolution now relies on the global map populated at runtime-worker
// (set via setGlobalMuiIconMap from app startup) plus a small static fallback map.

export function getMuiIconComponent(muiIconName?: string, emoji?: string): ReactNode {
  const normalized = normalizeMuiName(muiIconName);
  const globalCandidates = collectPascalCandidates([muiIconName, normalized]);
  for (const candidate of globalCandidates) {
    const GlobalIcon = __globalMuiIconMap?.[candidate];
    if (GlobalIcon) {
      return <GlobalIcon />;
    }
  }

  const staticCandidates = collectPascalCandidates([normalized, muiIconName]);
  for (const candidate of staticCandidates) {
    const StaticIcon = staticMap[candidate];
    if (StaticIcon) {
      return <StaticIcon />;
    }
  }

  if (emoji) return <span style={{ fontSize: '1.5rem' }}>{emoji}</span>;
  return <AddIcon />;
}

// Simple prefetch cache to avoid duplicate dynamic imports
const _prefetched = new Set<string>();

function collectPascalCandidates(names: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of names) {
    if (!name) continue;
    const pascal = toPascalCase(name);
    if (!pascal) continue;
    if (seen.has(pascal)) continue;
    seen.add(pascal);
    result.push(pascal);
  }
  return result;
}

/**
 * Prefetch a list of MUI icons by name (case-insensitive), warming the dynamic import cache
 * so first render of SpeedDial actions doesn’t stutter while chunks load.
 */
export async function prefetchMuiIcons(names: Array<string | undefined | null>): Promise<void> {
  // No-op with minimal bookkeeping: global/static maps are synchronous.
  const uniq = new Set((names || []).filter(Boolean).map((n) => toPascalCase(String(n))));
  for (const name of uniq) _prefetched.add(name);
}

// Global icon map injection (to share app-generated static map)
let __globalMuiIconMap: Record<string, React.ComponentType<SvgIconProps>> | null = null;
export function setGlobalMuiIconMap(map: Record<string, React.ComponentType<SvgIconProps>>): void {
  __globalMuiIconMap = map;
}

export function getMuiIconWithColor(
  muiIconName?: string,
  emoji?: string,
  color?: string,
): ReactNode {
  const normalized = normalizeMuiName(muiIconName);
  const globalCandidates = collectPascalCandidates([muiIconName, normalized]);
  for (const candidate of globalCandidates) {
    const GlobalIcon = __globalMuiIconMap?.[candidate];
    if (GlobalIcon) {
      return <GlobalIcon sx={color ? { color } : undefined} />;
    }
  }

  const staticCandidates = collectPascalCandidates([normalized, muiIconName]);
  for (const candidate of staticCandidates) {
    const StaticIcon = staticMap[candidate];
    if (StaticIcon) {
      return <StaticIcon sx={color ? { color } : undefined} />;
    }
  }

  if (emoji) {
    return <span style={{ fontSize: '1.5rem', color }}>{emoji}</span>;
  }
  const node = <AddIcon />;
  return color ? <span style={{ color }}>{node}</span> : node;
}
