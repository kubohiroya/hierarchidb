import { MenuItem, MenuList, Typography } from '@mui/material';
import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';
// InlineIcon should be imported from @hierarchidb/ui package
// For now, we'll create a simple inline version
const InlineIcon = ({ icon }: { icon: ReactNode }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: '8px' }}>{icon}</span>
);

export type NavLinkItemType = {
  name: string;
  icon: ReactNode;
  url: string;
};

export const NavLinkMenu = ({ items }: { items: NavLinkItemType[] }) => {
  if (items.length === 0) return null;
  return (
    <MenuList sx={{ marginBottom: '30px', backgroundColor: 'red' }}>
      {items.map((item, index) => (
        <MenuItem key={index} sx={{ padding: 0, margin: 0 }} aria-label={item.name}>
          <NavLink
            to={item.url}
            style={({ isActive }: { isActive: boolean }) => ({
              color: isActive ? '#c34' : '#545e6f',
              width: '100%',
            })}
          >
            <InlineIcon icon={item.icon} />
            <Typography sx={{ marginLeft: 1 }} component="span">
              {item.name}
            </Typography>
          </NavLink>
        </MenuItem>
      ))}
    </MenuList>
  );
};
