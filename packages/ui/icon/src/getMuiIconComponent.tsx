/**
 * getMuiIconComponent
 *
 * ハードコーディングの限定マッピングに依存しない、MUI Icons 名→コンポーネント変換。
 * emoji 指定があれば emoji を返し、文字列名は PascalCase に正規化して
 * `@mui/icon-material/<Name>` を React.lazy + dynamic import で読み込みます。
 * 読み込み中/失敗時は Add アイコンをフォールバック表示します。
 */
import type { ReactNode } from 'react';
import React, { Suspense } from 'react';
import { Add as AddIcon } from '@mui/icons-material';

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

function IconByName({ name }: { name: string }) {
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
          return { default: AddIcon };
        }
      }),
    [name],
  );

  return (
    <Suspense fallback={<AddIcon />}>
      <LazyIcon />
    </Suspense>
  );
}

export function getMuiIconComponent(muiIconName?: string, emoji?: string): ReactNode {
  if (emoji) return <span style={{ fontSize: '1.5rem' }}>{emoji}</span>;
  const pascal = toPascalCase(muiIconName);
  if (!pascal) return <AddIcon />;
  return <IconByName name={pascal} />;
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
      try {
        await import(/* @vite-ignore */ `@mui/icons-material/${name}`);
        _prefetched.add(name);
      } catch {
        // Swallow; we'll fallback to AddIcon at render if missing
      }
    }),
  );
}
