import {
  ArrowBack as ArrowBackIcon,
  Close as CloseIcon,
  FullscreenExit as FullscreenExitIcon,
  Fullscreen as FullscreenIcon,
  Minimize as MinimizeIcon,
  OpenInFull as OpenInFullIcon,
  CropSquare as RestoreIcon,
} from '@mui/icons-material';
import { IconButton, Tooltip } from '@mui/material';
import type React from 'react';
import { useTranslation } from '@hierarchidb/ui-i18n';

type CommonProps = {
  disabled?: boolean;
  onPointerDown?: React.PointerEventHandler;
};

const useDialogTooltips = () => {
  const { t } = useTranslation('common');
  return {
    maximize: t('dialogs.pluginDialog.tooltips.maximize', 'Maximize'),
    restoreSize: t('dialogs.pluginDialog.tooltips.restoreSize', 'Restore'),
    fullscreen: t('dialogs.pluginDialog.tooltips.fullscreen', 'Full screen'),
    exitFullscreen: t('dialogs.pluginDialog.tooltips.exitFullscreen', 'Exit full screen'),
    minimize: t('dialogs.pluginDialog.tooltips.minimize', 'Minimize'),
    restoreMinimized: t('dialogs.pluginDialog.tooltips.restoreMinimized', 'Restore'),
    close: t('dialogs.pluginDialog.tooltips.close', 'Close dialog'),
  };
};

export const PluginDialogMaximizeButton: React.FC<
  CommonProps & { displayMode: 'default' | 'maximize' | 'full-screen'; onClick: () => void }
> = ({ displayMode, onClick, onPointerDown, disabled }) => {
  const isMaximized = displayMode === 'maximize';
  const tooltips = useDialogTooltips();
  return (
    <Tooltip title={isMaximized ? tooltips.restoreSize : tooltips.maximize}>
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
    <Tooltip title={isFullScreen ? tooltips.exitFullscreen : tooltips.fullscreen}>
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

export const PluginDialogMinimizeButton: React.FC<
  CommonProps & { isMinimized: boolean; onClick: () => void }
> = ({ isMinimized, onClick, onPointerDown, disabled }) => {
  const tooltips = useDialogTooltips();
  const label = isMinimized ? tooltips.restoreMinimized : tooltips.minimize;
  return (
    <Tooltip title={label}>
      <span>
        <IconButton
          size="small"
          color={isMinimized ? 'primary' : 'default'}
          onClick={onClick}
          onPointerDown={onPointerDown}
          disabled={disabled}
          aria-label={label}
        >
          {isMinimized ? <RestoreIcon fontSize="small" /> : <MinimizeIcon fontSize="small" />}
        </IconButton>
      </span>
    </Tooltip>
  );
};

type CloseButtonProps = CommonProps & {
  onClick: () => void;
  size?: 'small' | 'medium' | 'large';
  iconVariant?: 'close' | 'back';
};

export const PluginDialogCloseButton: React.FC<CloseButtonProps> = ({
  onClick,
  onPointerDown,
  disabled,
  size = 'small',
  iconVariant = 'close',
}) => {
  const tooltips = useDialogTooltips();
  const icon = iconVariant === 'back'
    ? <ArrowBackIcon fontSize={size === 'large' ? 'large' : 'small'} />
    : <CloseIcon fontSize="small" />;
  return (
    <Tooltip title={tooltips.close}>
      <IconButton
        size={size}
        onClick={onClick}
        onPointerDown={onPointerDown}
        disabled={disabled}
        aria-label={tooltips.close}
      >
        {icon}
      </IconButton>
    </Tooltip>
  );
};
