import type React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import {
  FullscreenExit as FullscreenExitIcon,
  Fullscreen as FullscreenIcon,
  OpenInFull as OpenInFullIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

type CommonProps = {
  disabled?: boolean;
  onPointerDown?: React.PointerEventHandler;
};

const useDialogTooltips = () => {
  const { t } = useTranslation('common');
  return {
    maximize: t('dialogs.pluginDialog.tooltips.maximize', 'Maximize'),
    restoreSize: t('dialogs.pluginDialog.tooltips.restoreSize', 'Restore size'),
    fullscreen: t('dialogs.pluginDialog.tooltips.fullscreen', 'Full screen'),
    exitFullscreen: t('dialogs.pluginDialog.tooltips.exitFullscreen', 'Exit full screen'),
    close: t('dialogs.pluginDialog.tooltips.close', 'Close dialog'),
  };
};

export const PluginDialogMaximizeButton: React.FC<
  CommonProps & { displayMode: 'default' | 'maximize' | 'full-screen'; onClick: () => void }
> = ({ displayMode, onClick, onPointerDown, disabled }) => {
  const isMaximized = displayMode === 'maximize';
  const tooltips = useDialogTooltips();
  return (
    <Tooltip
      title={isMaximized ? tooltips.restoreSize : tooltips.maximize}
    >
      <span>
        <IconButton
          size="small"
          color={isMaximized ? 'primary' : 'default'}
          onClick={onClick}
          onPointerDown={onPointerDown}
          disabled={disabled}
          aria-label={isMaximized ? tooltips.restoreSize : tooltips.maximize}
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
  const tooltips = useDialogTooltips();
  return (
    <Tooltip
      title={isFullScreen ? tooltips.exitFullscreen : tooltips.fullscreen}
    >
      <span>
        <IconButton
          size="small"
          color={isFullScreen ? 'primary' : 'default'}
          onClick={onClick}
          onPointerDown={onPointerDown}
          disabled={disabled}
          aria-label={isFullScreen ? tooltips.exitFullscreen : tooltips.fullscreen}
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
  const tooltips = useDialogTooltips();
  return (
    <Tooltip title={tooltips.close}>
      <IconButton
        size="small"
        onClick={onClick}
        onPointerDown={onPointerDown}
        disabled={disabled}
        aria-label={tooltips.close}
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
};
