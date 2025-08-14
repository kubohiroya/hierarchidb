import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { MenuItem, MenuList, Typography } from '@mui/material';
import { NavLink } from 'react-router-dom';
// InlineIcon should be imported from @hierarchidb/ui package
// For now, we'll create a simple inline version
const InlineIcon = ({ icon }) =>
  _jsx('span', {
    style: { display: 'inline-flex', alignItems: 'center', marginRight: '8px' },
    children: icon,
  });
export const NavLinkMenu = ({ items }) => {
  if (items.length === 0) return null;
  return _jsx(MenuList, {
    sx: { marginBottom: '30px', backgroundColor: 'red' },
    children: items.map((item, index) =>
      _jsx(
        MenuItem,
        {
          sx: { padding: 0, margin: 0 },
          'aria-label': item.name,
          children: _jsxs(NavLink, {
            to: item.url,
            style: ({ isActive }) => ({
              color: isActive ? '#c34' : '#545e6f',
              width: '100%',
            }),
            children: [
              _jsx(InlineIcon, { icon: item.icon }),
              _jsx(Typography, { sx: { marginLeft: 1 }, component: 'span', children: item.name }),
            ],
          }),
        },
        index
      )
    ),
  });
};
//# sourceMappingURL=NavLinkMenu.js.map
