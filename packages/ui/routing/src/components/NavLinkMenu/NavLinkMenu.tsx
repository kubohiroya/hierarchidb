import { MenuItem, MenuList, Typography } from '@mui/material';
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
          <a
            href={item.url}
            style={{
              color: '#545e6f',
              width: '100%',
              textDecoration: 'none',
            }}
          >
            <InlineIcon iconName={typeof item.icon === 'string' ? item.icon : 'icon'}>
              {item.icon}
            </InlineIcon>
            <Typography sx={{ marginLeft: 1 }} component="span">
              {item.name}
            </Typography>
          </a>
        </MenuItem>
      ))}
    </MenuList>
  );
};
