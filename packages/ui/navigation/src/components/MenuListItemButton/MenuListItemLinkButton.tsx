// Local implementation - using provider-router-dom directly
import { IconButton, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import SpeedDialIcon from '@mui/material/SpeedDialIcon';
import { Link, useLocation } from '@tanstack/react-router';
import {
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useMemo,
  useState,
} from 'react';

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
  const location = useLocation();
  const [anchorElem, setAnchorElem] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorElem);

  const handleMenuOpenButtonClick = (event: MouseEvent<HTMLButtonElement>) => {
    setAnchorElem(event.currentTarget);
  };

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
    []
  );

  let dividerKeyCounter = 0;

  return (
    <>
      <IconButton
        id={`${id}-button`}
        sx={{ position: 'absolute', bottom: 10, right: 13, zIndex: 100 }}
        onClick={handleMenuOpenButtonClick}
      >
        <SpeedDialIcon />
      </IconButton>
      <Menu id={`${id}-menu`} anchorEl={anchorElem} open={open} onClose={() => setAnchorElem(null)}>
        {items.map((item: MenuItemLinkType | null) => {
          if (item) {
            const targetPath = `${currentPath}/${item.url}`;
            const itemKey = item.url || `${item.name}-${id}`;
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
          dividerKeyCounter += 1;
          return <MenuItem key={`${id}-divider-${dividerKeyCounter}`} divider />;
        })}
      </Menu>
    </>
  );
};
