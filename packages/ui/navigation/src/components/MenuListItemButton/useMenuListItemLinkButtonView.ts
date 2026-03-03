import { useCallback, useMemo, useState } from 'react';
import type { CSSProperties, MouseEvent } from 'react';
import { useLocation } from '@tanstack/react-router';
import type { MenuItemLinkType } from './MenuListItemLinkButton.js';

export interface UseMenuListItemLinkButtonViewParams {
  id: string;
  items: Array<MenuItemLinkType | null>;
}

export interface UseMenuListItemLinkButtonViewResult {
  anchorElem: null | HTMLElement;
  open: boolean;
  currentPath: string;
  baseLinkStyle: CSSProperties;
  itemKeys: string[];
  handleMenuOpenButtonClick: (event: MouseEvent<HTMLButtonElement>) => void;
  handleMenuClose: () => void;
  handleMenuItemClick: (_url: string) => void;
}

export function useMenuListItemLinkButtonView({
  id,
  items,
}: UseMenuListItemLinkButtonViewParams): UseMenuListItemLinkButtonViewResult {
  const location = useLocation();
  const [anchorElem, setAnchorElem] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorElem);

  const handleMenuOpenButtonClick = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    setAnchorElem(event.currentTarget);
  }, []);

  const handleMenuClose = useCallback(() => {
    setAnchorElem(null);
  }, []);

  const handleMenuItemClick = useCallback((_url: string) => {
    setAnchorElem(null);
  }, []);

  const currentPath = location.pathname ?? '';
  const baseLinkStyle = useMemo<CSSProperties>(
    () => ({
      textDecoration: 'none',
      whiteSpace: 'nowrap',
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'flex-start',
      color: 'inherit',
    }),
    [],
  );

  const itemKeys = useMemo(() => {
    let dividerKeyCounter = 0;
    return items.map((item) => {
      if (item) {
        return item.url || `${item.name}-${id}`;
      }
      dividerKeyCounter += 1;
      return `${id}-divider-${dividerKeyCounter}`;
    });
  }, [id, items]);

  return {
    anchorElem,
    open,
    currentPath,
    baseLinkStyle,
    itemKeys,
    handleMenuOpenButtonClick,
    handleMenuClose,
    handleMenuItemClick,
  };
}
