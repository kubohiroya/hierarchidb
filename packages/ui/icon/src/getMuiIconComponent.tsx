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
import React, { Suspense } from 'react';
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

function IconByName({ name, emoji }: { name: string; emoji?: string }) {
  // Fast path: resolve from a small static map to avoid dynamic import pitfalls
  const staticMap: Record<string, React.ComponentType | undefined> = {
    Folder: FolderIcon,
    Public: PublicIcon,
    Hexagon: HexagonIcon,
    LocationOn: LocationOnIcon,
    Route: RouteIcon,
    Assessment: AssessmentIcon,
    Palette: PaletteIcon,
    Extension: ExtensionIcon,
    AccountTree: AccountTreeIcon,
  };
  const StaticComp = staticMap[name];
  if (StaticComp) return <StaticComp />;
  const LazyIcon = React.useMemo(
      () =>
      React.lazy(async () => {
        try {
          const mod = await import(
            /* @vite-ignore */ `@mui/icons-material/${name}`
          );
          const C = (mod as any).default || (mod as any)[name];
          return { default: (C as React.ComponentType) ?? AddIcon };
        } catch {
          // If MUI icon not found or failed to load, prefer emoji fallback when provided
          if (emoji) {
            // eslint-disable-next-line no-console
            console.warn(`[ui-icon] MUI icon not found: ${name}. Falling back to emoji: ${emoji}`);
            const Fallback = () => <span style={{ fontSize: '1.5rem' }}>{emoji}</span>;
            return { default: Fallback as unknown as React.ComponentType };
          }
          // eslint-disable-next-line no-console
          console.warn(`[ui-icon] MUI icon not found: ${name}. Falling back to AddIcon.`);
          return { default: AddIcon };
        }
      }),
    [name, emoji],
  );

  // Prioritize MUI icon: show neutral fallback while loading.
  // Emoji is used only if the import fails (see catch above), not during load.
  const Fallback = <AddIcon />;
  return (
    <Suspense fallback={Fallback}>
      <LazyIcon />
    </Suspense>
  );
}

export function getMuiIconComponent(muiIconName?: string, emoji?: string): ReactNode {
  // Primary: MUI icon by name (if provided)
  const normalized = normalizeMuiName(muiIconName);
  const pascal = toPascalCase(normalized);
  if (pascal) return <IconByName name={pascal} emoji={emoji} />;
  // Secondary: emoji fallback when no valid MUI name given
  if (emoji) return <span style={{ fontSize: '1.5rem' }}>{emoji}</span>;
  // Final fallback
  return <AddIcon />;
}

// Simple prefetch cache to avoid duplicate dynamic imports
const _prefetched = new Set<string>();

/**
 * Prefetch a list of MUI icons by name (case-insensitive), warming the dynamic import cache
 * so first render of SpeedDial actions doesn’t stutter while chunks load.
 */
export async function prefetchMuiIcons(names: Array<string | undefined | null>): Promise<void> {
  const unique = Array.from(
    new Set(
      (names || [])
        .filter(Boolean)
        .map((n) => toPascalCase(String(n)))
        .filter((n) => !!n && !_prefetched.has(n as string)) as string[],
    ),
  );
  await Promise.all(
    unique.map(async (name) => {
      await import(/* @vite-ignore */ `@mui/icons-material/${name}`);
      _prefetched.add(name);
    }),
  );
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
  const pascal = toPascalCase(normalizeMuiName(muiIconName));
  const C = (__globalMuiIconMap as any)?.[pascal] as React.ComponentType<SvgIconProps> | undefined;
  if (C) return <C sx={color ? { color } : undefined} />;
  // Fallback to library resolver; try static map → dynamic import; wrap for color if needed
  const node = getMuiIconComponent(muiIconName, emoji) as any;
  return color ? <span style={{ color }}>{node as React.ReactNode}</span> : (node as React.ReactNode);
}
