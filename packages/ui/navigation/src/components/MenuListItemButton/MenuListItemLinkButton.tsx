// Local implementation - using react-router-dom directly
import {
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from '@mui/material';
import SpeedDialIcon from '@mui/material/SpeedDialIcon';
import { MouseEvent, type ReactNode, useCallback, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

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
              onClick={() => handleMenuItemClick(`${location.pathname}/${item.url}`)}
              aria-label={item.name}
            >
              <Link
                to={`${location.pathname}/${item.url}`}
                style={{
                  textDecoration: 'none',
                  whiteSpace: 'no-wrap',
                  display: 'flex',
                  flexDirection: 'row',
                  justifyContent: 'flex-start',
                  color: 'inherit',
                }}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText>{item.name}</ListItemText>
              </Link>
            </MenuItem>
          ) : (
            <MenuItem key={index} divider />
          )
        )}
      </Menu>
    </>
  );
};
