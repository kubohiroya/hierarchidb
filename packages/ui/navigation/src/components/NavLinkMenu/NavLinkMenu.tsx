import { MenuItem, MenuList, Typography } from '@mui/material';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useNavLinkMenuView } from './useNavLinkMenuView.js';

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
  const { hasItems, activeLinkStyle, inactiveLinkStyle, itemViewModels } =
    useNavLinkMenuView(items);
  if (!hasItems) return null;

  return (
    <MenuList sx={{ marginBottom: '30px', backgroundColor: 'red' }}>
      {itemViewModels.map((viewModel) => (
        <MenuItem key={viewModel.key} sx={{ padding: 0, margin: 0 }} aria-label={viewModel.name}>
          <Link
            to={viewModel.target}
            preload="intent"
            activeProps={{ style: activeLinkStyle }}
            inactiveProps={{ style: inactiveLinkStyle }}
          >
            <InlineIcon icon={viewModel.icon} />
            <Typography sx={{ marginLeft: 1 }} component="span">
              {viewModel.name}
            </Typography>
          </Link>
        </MenuItem>
      ))}
    </MenuList>
  );
};
