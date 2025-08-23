/**
 * SpeedDialMenu - MUI SpeedDialを使用したフローティングアクションボタン
 *
 * 元のSpeedDialMenuの見た目を再現
 */

import { useState } from 'react';
import { SpeedDial, SpeedDialAction, SpeedDialIcon } from '@mui/material';
import type {SpeedDialActionType, SpeedDialMenuProps} from '../types';

/**
 * SpeedDialMenuコンポーネント
 * 元のSpeedDialMenuの見た目を再現
 */
export function SpeedDialMenu({
  actions,
  icon,
  tooltipTitle,
  color = 'primary',
  position = { bottom: 10, right: 10 },
  direction = 'up',
  zIndex = 1000,
  hidden = false,
}: SpeedDialMenuProps) {
  const [open, setOpen] = useState(false);

  const handleClose = () => setOpen(false);
  const handleToggle = () => setOpen(!open);

  const handleActionClick = (onClick?: () => void) => {
    if (onClick) {
      onClick();
    }
    handleClose();
  };

  if (hidden) {
    return null;
  }

  return (
    <SpeedDial
      ariaLabel={tooltipTitle || 'Speed Dial'}
      aria-haspopup="menu"
      aria-expanded={open}
      data-testid={open ? "speed-dial-menu" : "speed-dial-fab"}
      sx={{
        position: 'absolute',
        ...position,
        zIndex,
        '& .MuiSpeedDial-fab': {
          bgcolor: `${color}.main`,
          color: 'white',
          '&:hover': {
            bgcolor: `${color}.dark`,
          },
        },
      }}
      icon={icon || <SpeedDialIcon />}
      direction={direction}
      onClick={handleToggle}
      open={open}
      onClose={handleClose}
    >
      {actions.map((action: SpeedDialActionType, index: number) => (
        <SpeedDialAction
          key={`${action.name}`}
          icon={action.icon}
          tooltipTitle={action.name}
          onClick={() => handleActionClick(action.onClick)}
          sx={action.color ? { color: action.color } : {}}
          data-testid={
            action.name === 'Create Folder' ? 'create-folder-action' :
            action.name === 'Create Note' ? 'create-note-action' :
            action.name === 'Create File' ? 'create-file-action' :
            `speed-dial-action-${index}`
          }
        />
      ))}
    </SpeedDial>
  );
}
