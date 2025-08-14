/**
 * @file SpeedDialMenu.tsx
 * @description A floating action button (FAB) menu component that expands to show multiple
 * action options. Provides Material Design speed dial functionality with automatic closing
 * when dialogs open and unified click behavior across devices.
 *
 * @module components/ui/SpeedDialMenu
 *
 * @usage
 * - Project management quick actions (ProjectPanel)
 * - Resource creation menus
 * - Debug and testing interfaces (test-multi-dialog page)
 *
 * @dependencies
 * - @mui/material: SpeedDial, SpeedDialAction, SpeedDialIcon components
 * - React Router: useLocation for hash-based dialog detection
 * - DialogContext: Dialog state management
 * - SpeedDialActionType: Action configuration type
 */

import { SpeedDial, SpeedDialAction, SpeedDialIcon } from '@mui/material';
import { type ReactNode, useEffect, useState } from 'react';
import type { SpeedDialActionType } from '@/components/ui/SpeedDialMenu/SpeedDialActionType';
import { useLocation } from 'react-router';

export const SpeedDialMenu = ({
  id,
  actions,
  icon,
  position = { bottom: 10, right: 10 },
  color = 'primary',
}: {
  id: string;
  actions: Array<SpeedDialActionType>;
  disabled?: boolean;
  icon?: ReactNode;
  tooltipTitle?: string;
  position?: { bottom: number; right: number };
  color?: 'primary' | 'secondary' | 'inherit';
}) => {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Close speed dial when hash dialog opens
  useEffect(() => {
    if (location.hash.includes('dialog=')) {
      setOpen(false);
    }
  }, [location.hash]);

  const handleClose = () => setOpen(false);

  const handleToggle = () => {
    if (!open) {
      setOpen(true);
    } else {
      setOpen(false);
    }
  };

  const handleActionClick = (onClick: (() => void) | undefined) => {
    if (onClick) {
      onClick();
    }
    handleClose();
  };

  // Use click to open/close for all devices (unified behavior)
  const speedDialProps = {
    onClick: handleToggle,
    open: open,
    onClose: handleClose,
  };

  return (
    <SpeedDial
      id={id}
      ariaLabel="Create Action"
      aria-haspopup="menu"
      aria-expanded={open}
      sx={{
        position: 'absolute',
        ...position,
        zIndex: 1000,
        '& .MuiSpeedDial-fab': {
          bgcolor: `${color}.main`,
          color: 'white',
          '&:hover': {
            bgcolor: `${color}.dark`,
          },
        },
      }}
      icon={icon || <SpeedDialIcon />}
      direction="up"
      {...speedDialProps}
    >
      {actions.map((action, index) => (
        <SpeedDialAction
          key={index}
          icon={action.icon}
          title={action.name}
          role="menuitem"
          aria-label={action.name}
          open={open}
          onClick={() => handleActionClick(action.onClick)}
          sx={{
            color: action.color || `${color}.main`,
            '& .MuiSpeedDialAction-fab': {
              bgcolor: `${color}.main`,
              color: 'white',
              '&:hover': {
                bgcolor: `${color}.dark`,
              },
            },
          }}
        />
      ))}
    </SpeedDial>
  );
};
