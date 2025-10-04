import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from 'react/jsx-runtime';
import {
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  SpeedDialIcon,
} from '@mui/material';
import { useCallback, useMemo, useState } from 'react';
import { Link, useLocation } from '@tanstack/react-router';
export const MenuListItemLinkButton = ({ id, items }) => {
  const location = useLocation();
  const [anchorElem, setAnchorElem] = useState(null);
  const open = Boolean(anchorElem);
  const handleMenuOpenButtonClick = (event) => {
    setAnchorElem(event.currentTarget);
  };
  const handleMenuItemClick = useCallback((_url) => {
    setAnchorElem(null);
  }, []);
  const currentPath = location.pathname ?? '';
  const baseLinkStyle = useMemo(
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
  return _jsxs(_Fragment, {
    children: [
      _jsx(IconButton, {
        id: id + '-button',
        sx: { position: 'absolute', bottom: 10, right: 13, zIndex: 100 },
        onClick: handleMenuOpenButtonClick,
        children: _jsx(SpeedDialIcon, {}),
      }),
      _jsx(Menu, {
        id: id + '-menu',
        anchorEl: anchorElem,
        open: open,
        onClose: () => setAnchorElem(null),
        children: items.map((item, index) =>
          item
            ? _jsx(
                MenuItem,
                {
                  onClick: () => handleMenuItemClick(`${currentPath}/${item.url}`),
                  'aria-label': item.name,
                  children: _jsxs(Link, {
                    to: `${currentPath}/${item.url}`,
                    preload: "intent",
                    style: baseLinkStyle,
                    children: [
                      _jsx(ListItemIcon, { children: item.icon }),
                      _jsx(ListItemText, { children: item.name }),
                    ],
                  }),
                },
                index
              )
            : _jsx(MenuItem, { divider: true }, index)
        ),
      }),
    ],
  });
};
//# sourceMappingURL=MenuListItemLinkButton.js.map
