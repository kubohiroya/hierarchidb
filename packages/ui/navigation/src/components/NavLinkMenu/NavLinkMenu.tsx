import { MenuItem, MenuList, Typography } from '@mui/material';
import { Link } from '@tanstack/react-router';
import type { CSSProperties, ReactNode } from 'react';
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

const baseLinkStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  textDecoration: 'none',
};

export const NavLinkMenu = ({ items }: { items: NavLinkItemType[] }) => {
  if (items.length === 0) return null;

  return (
    <MenuList sx={{ marginBottom: '30px', backgroundColor: 'red' }}>
      {items.map((item, index) => (
        <MenuItem key={index} sx={{ padding: 0, margin: 0 }} aria-label={item.name}>
          <Link
            to={item.url as any}
            preload="intent"
            activeProps={{ style: { ...baseLinkStyle, color: '#c34' } }}
            inactiveProps={{ style: { ...baseLinkStyle, color: '#545e6f' } }}
          >
            <InlineIcon icon={item.icon} />
            <Typography sx={{ marginLeft: 1 }} component="span">
              {item.name}
            </Typography>
          </Link>
        </MenuItem>
      ))}
    </MenuList>
  );
};
