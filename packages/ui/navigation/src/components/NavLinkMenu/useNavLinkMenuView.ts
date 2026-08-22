import type { CSSProperties, ReactNode } from 'react';
import { useMemo } from 'react';

export interface NavLinkMenuItemViewModel {
  key: string;
  target: string;
  name: string;
  icon: ReactNode;
  isEmpty: boolean;
}

export interface UseNavLinkMenuViewResult {
  hasItems: boolean;
  baseLinkStyle: CSSProperties;
  activeLinkStyle: CSSProperties;
  inactiveLinkStyle: CSSProperties;
  itemViewModels: NavLinkMenuItemViewModel[];
}

export function useNavLinkMenuView(
  items: Array<{ name: string; url: string; icon: ReactNode }>
): UseNavLinkMenuViewResult {
  const baseLinkStyle = useMemo<CSSProperties>(
    () => ({
      display: 'flex',
      alignItems: 'center',
      width: '100%',
      textDecoration: 'none',
    }),
    []
  );

  const activeLinkStyle = useMemo<CSSProperties>(
    () => ({ ...baseLinkStyle, color: '#c34' }),
    [baseLinkStyle]
  );

  const inactiveLinkStyle = useMemo<CSSProperties>(
    () => ({ ...baseLinkStyle, color: '#545e6f' }),
    [baseLinkStyle]
  );

  const itemViewModels = useMemo<NavLinkMenuItemViewModel[]>(
    () =>
      items.map((item) => ({
        key: item.url || item.name,
        target: item.url,
        name: item.name,
        icon: item.icon,
        isEmpty: !item.url && !item.name,
      })),
    [items]
  );

  return {
    hasItems: items.length > 0,
    baseLinkStyle,
    activeLinkStyle,
    inactiveLinkStyle,
    itemViewModels,
  };
}
