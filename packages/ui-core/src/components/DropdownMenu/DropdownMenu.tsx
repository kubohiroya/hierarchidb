/**
 * @file DropdownMenu.tsx
 * @description A generic dropdown menu component that provides a clickable trigger element
 * with a popup menu of actions. Supports icons, dividers, and custom click handlers for
 * each menu item.
 *
 * @module components/ui/DropdownMenu
 *
 * @usage
 * - User avatar menus (UserAvatarMenu)
 * - Context menus for list items
 * - Action menus in toolbars and headers
 *
 * @dependencies
 * - @mui/material: Menu, MenuItem, Box, ListItemIcon, ListItemText components
 * - React: hooks (useState, useCallback)
 * - DropdownMenuItemType: Menu item configuration type
 */

import { Box, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import { MouseEvent, type ReactNode, useCallback, useState } from 'react';
import type { DropdownMenuItemType } from './DropdownMenuItemType';

export const DropdownMenu = ({
  id,
  items,
  disabled,
  color,
  children,
}: {
  id: string;
  items: Array<DropdownMenuItemType | null>;
  disabled?: boolean;
  color?: string;
  children?: ReactNode;
}) => {
  const [anchorElem, setAnchorElem] = useState<null | HTMLElement>(null);
  const handleMenuOpenButtonClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!disabled && event.currentTarget) {
        setAnchorElem(event.currentTarget);
      }
    },
    [disabled]
  );
  const handleMenuItemClick = useCallback((onClick: (() => void) | undefined) => {
    if (onClick) {
      onClick();
    }
    setAnchorElem(null);
  }, []);
  const open = Boolean(anchorElem);

  return (
    <>
      <Box style={{ marginTop: '-1.775px' }} onClick={handleMenuOpenButtonClick}>
        {children}
      </Box>
      <Menu id={id + '-menu'} anchorEl={anchorElem} open={open} onClose={() => setAnchorElem(null)}>
        {items.map((item: DropdownMenuItemType | null, index: number) =>
          item ? (
            <MenuItem
              key={index}
              onClick={() => handleMenuItemClick(item.onClick)}
              aria-label={item.name}
            >
              <span
                style={{
                  textDecoration: 'none',
                  whiteSpace: 'no-wrap',
                  display: 'flex',
                  flexDirection: 'row',
                  justifyContent: 'flex-start',
                  color: 'inherit',
                }}
              >
                <ListItemIcon color={color || 'default'}>{item.icon}</ListItemIcon>
                <ListItemText>{item.name}</ListItemText>
              </span>
            </MenuItem>
          ) : (
            <MenuItem key={index} divider />
          )
        )}
      </Menu>
    </>
  );
};
