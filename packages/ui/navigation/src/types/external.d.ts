declare module '@hierarchidb/ui-icon' {
  import type { ReactNode } from 'react';
  export function getMuiIconComponent(muiIconName?: string, emoji?: string): ReactNode;
  export function toPascalCase(name?: string): string;
  export function prefetchMuiIcons(names: Array<string | undefined | null>): Promise<void>;
}

