import { MenuItem, MenuList, Typography } from '@mui/material';
import { NavLink } from 'react-router';
// Mock InlineIcon component
const InlineIcon = ({ iconName, ...props }: { iconName: string; [key: string]: any }) => (
  <span {...props}>{iconName}</span>
);
import type { ReactNode } from 'react';

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
            <InlineIcon iconName={typeof item.icon === 'string' ? item.icon : 'icon'}>
              {item.icon}
            </InlineIcon>
            <Typography sx={{ marginLeft: 1 }} component="span">
              {item.name}
            </Typography>
          </NavLink>
        </MenuItem>
      ))}
    </MenuList>
  );
};
