import type React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import {
  FullscreenExit as FullscreenExitIcon,
  Fullscreen as FullscreenIcon,
  OpenInFull as OpenInFullIcon,
  Close as CloseIcon,
} from '@mui/icons-material';

type CommonProps = {
  disabled?: boolean;
  onPointerDown?: React.PointerEventHandler;
};

export const PluginDialogMaximizeButton: React.FC<
  CommonProps & { displayMode: 'default' | 'maximize' | 'full-screen'; onClick: () => void }
> = ({ displayMode, onClick, onPointerDown, disabled }) => {
  const isMaximized = displayMode === 'maximize';
  return (
    <Tooltip
      title={
        isMaximized
          ? 'Restore size'
          : 'Maximize'
      }
    >
      <span>
        <IconButton
          size="small"
          color={isMaximized ? 'primary' : 'default'}
          onClick={onClick}
          onPointerDown={onPointerDown}
          disabled={disabled}
        >
          {isMaximized ? (
            <FullscreenExitIcon fontSize="small" />
          ) : (
            <OpenInFullIcon fontSize="small" />
          )}
        </IconButton>
      </span>
    </Tooltip>
  );
};

export const PluginDialogFullScreenButton: React.FC<
  CommonProps & { displayMode: 'default' | 'maximize' | 'full-screen'; onClick: () => void }
> = ({ displayMode, onClick, onPointerDown, disabled }) => {
  const isFullScreen = displayMode === 'full-screen';
  return (
    <Tooltip
      title={
        isFullScreen
          ? 'Exit full screen'
          : 'Full screen'
      }
    >
      <span>
        <IconButton
          size="small"
          color={isFullScreen ? 'primary' : 'default'}
          onClick={onClick}
          onPointerDown={onPointerDown}
          disabled={disabled}
        >
          {isFullScreen ? (
            <FullscreenExitIcon fontSize="small" />
          ) : (
            <FullscreenIcon fontSize="small" />
          )}
        </IconButton>
      </span>
    </Tooltip>
  );
};

export const PluginDialogCloseButton: React.FC<
  CommonProps & { onClick: () => void }
> = ({ onClick, onPointerDown, disabled }) => {
  return (
    <Tooltip title="Close">
      <IconButton
        size="small"
        onClick={onClick}
        onPointerDown={onPointerDown}
        disabled={disabled}
        aria-label="Close"
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
};

