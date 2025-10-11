import { IconButton, ListItemIcon, ListItemText, Menu, MenuItem, SpeedDialIcon } from '@mui/material';
import { type CSSProperties, type MouseEvent, type ReactNode, useCallback, useMemo, useState } from 'react';
import { Link, useLocation } from '@tanstack/react-router';

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
}): React.ReactElement => {
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
  const baseLinkStyle = useMemo<CSSProperties>(() => ({
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    color: 'inherit',
  }), []);

  return (
    <>
      <IconButton
        id={id + '-button'}
        sx={{ position: 'absolute', bottom: 10, right: 13, zIndex: 100 }}
        onClick={handleMenuOpenButtonClick}
      >
        <SpeedDialIcon />
      </IconButton>
      <Menu id={id + '-menu'} anchorEl={anchorElem} open={open} onClose={() => setAnchorElem(null)}>
        {items.map((item: MenuItemLinkType | null, index: number) =>
          item ? (
            <MenuItem
              key={index}
              onClick={() => handleMenuItemClick(`${currentPath}/${item.url}`)}
              aria-label={item.name}
            >
              <Link to={`${currentPath}/${item.url}`} style={baseLinkStyle} preload="intent">
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText>{item.name}</ListItemText>
              </Link>
            </MenuItem>
          ) : (
            <MenuItem key={index} divider />
          ),
        )}
      </Menu>
    </>
  );
};
