// Local implementation - using provider-router-dom directly
import { IconButton, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import SpeedDialIcon from '@mui/material/SpeedDialIcon';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useMenuListItemLinkButtonView } from './useMenuListItemLinkButtonView.js';

export type MenuItemLinkType = {
  name: string;
  icon: ReactNode;
  url: string;
};

export const MenuListItemLinkButton = ({
  id,
  items,
}: {
  id: string;
  items: Array<MenuItemLinkType | null>;
}) => {
  const {
    anchorElem,
    open,
    currentPath,
    baseLinkStyle,
    itemKeys,
    handleMenuOpenButtonClick,
    handleMenuClose,
    handleMenuItemClick,
  } = useMenuListItemLinkButtonView({
    id,
    items,
  });

  return (
    <>
      <IconButton
        id={`${id}-button`}
        sx={{ position: 'absolute', bottom: 10, right: 13, zIndex: 100 }}
        onClick={handleMenuOpenButtonClick}
      >
        <SpeedDialIcon />
      </IconButton>
      <Menu id={`${id}-menu`} anchorEl={anchorElem} open={open} onClose={handleMenuClose}>
        {items.map((item: MenuItemLinkType | null, index) => {
          if (item) {
            const targetPath = `${currentPath}/${item.url}`;
            const itemKey = itemKeys[index];
            return (
              <MenuItem
                key={itemKey}
                onClick={() => handleMenuItemClick(targetPath)}
                aria-label={item.name}
              >
                <Link to={targetPath} style={baseLinkStyle} preload="intent">
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText>{item.name}</ListItemText>
                </Link>
              </MenuItem>
            );
          }
          return <MenuItem key={itemKeys[index]} divider />;
        })}
      </Menu>
    </>
  );
};
