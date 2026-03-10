/**
 * @fileoverview CommonDialogTitle - Standardized base-dialog title component
 */

import React from 'react';
import { Box, Chip, DialogTitle, IconButton, Stack, Tooltip, Typography, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import {
  Close as CloseIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
} from '@mui/icons-material';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import { useTranslation } from '@hierarchidb/ui-i18n';
import {
  useCommonDialogTitleView,
} from './useCommonDialogTitleView.js';

export interface CommonDialogTitleProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  mode?: 'create' | 'edit' | 'preview';
  nodeId?: string;
  isDraft?: boolean;
  onClose: () => void;
  additionalActions?: React.ReactNode;
  /** Current display mode */
  displayMode?: 'normal' | 'maximize' | 'full-screen';
  /** Change display mode (normal/maximize/full-screen) */
  onChangeDisplayMode?: (mode: 'normal' | 'maximize' | 'full-screen') => void;
  /** Show mode switcher controls */
  showDisplayModeControls?: boolean;
}

export const CommonDialogTitle: React.FC<CommonDialogTitleProps> = ({
  title,
  subtitle,
  icon,
  mode,
  nodeId,
  isDraft = false,
  onClose,
  displayMode = 'normal',
  onChangeDisplayMode,
  showDisplayModeControls = true,
}) => {
  const { t } = useTranslation('common');
  const {
    modeMenuAnchor,
    isModeMenuOpen,
    showMaximizeToggle,
    maximizeToggleLabel,
    fullscreenToggleLabel,
    displayModeLabels,
    displayModeAriaLabel,
    openModeMenu,
    closeModeMenu,
    selectDisplayMode,
    toggleMaximize,
    toggleFullscreen,
  } = useCommonDialogTitleView({
    displayMode,
    onChangeDisplayMode,
  });

  const closeLabel = String(t('dialogs.common.actions.close', 'Close dialog'));

  return (
    <DialogTitle>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={2} alignItems="center">
          {icon}
          <Typography variant="h6">{title}</Typography>
          {mode && mode !== 'create' && nodeId && (
            <Typography variant="caption" color="text.secondary">
              ({nodeId})
            </Typography>
          )}
          {isDraft && <Chip label="Draft" size="small" variant="outlined" color="warning" />}
        </Stack>

        <Stack direction="row" spacing={1}>
          {showDisplayModeControls && onChangeDisplayMode && (
            <>
              <Tooltip title={displayModeAriaLabel}>
                <IconButton aria-label={displayModeAriaLabel} onClick={openModeMenu} size="small">
                  <OpenInFullIcon />
                </IconButton>
              </Tooltip>
              <Menu anchorEl={modeMenuAnchor} open={isModeMenuOpen} onClose={closeModeMenu} keepMounted>
                <MenuItem selected={displayMode === 'normal'} onClick={() => selectDisplayMode('normal')}>
                  <ListItemIcon>
                    <FullscreenExitIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>{displayModeLabels.normal}</ListItemText>
                </MenuItem>
                <MenuItem selected={displayMode === 'maximize'} onClick={() => selectDisplayMode('maximize')}>
                  <ListItemIcon>
                    <OpenInFullIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>{displayModeLabels.maximize}</ListItemText>
                </MenuItem>
                <MenuItem selected={displayMode === 'full-screen'} onClick={() => selectDisplayMode('full-screen')}>
                  <ListItemIcon>
                    <FullscreenIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>{displayModeLabels['full-screen']}</ListItemText>
                </MenuItem>
              </Menu>
              {showMaximizeToggle && (
                <Tooltip title={maximizeToggleLabel}>
                  <IconButton
                    aria-label={maximizeToggleLabel}
                    onClick={toggleMaximize}
                    size="small"
                  >
                    {displayMode === 'maximize' ? <FullscreenExitIcon /> : <OpenInFullIcon />}
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title={fullscreenToggleLabel}>
                <IconButton
                  aria-label={fullscreenToggleLabel}
                  onClick={toggleFullscreen}
                  size="small"
                >
                  {displayMode === 'full-screen' ? <FullscreenExitIcon /> : <FullscreenIcon />}
                </IconButton>
              </Tooltip>
            </>
          )}
          <Tooltip title={closeLabel}>
            <IconButton onClick={onClose} color="inherit" aria-label={closeLabel}>
              <CloseIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>
      {subtitle && (
        <Typography variant="body2" color="text.secondary">
          {subtitle}
        </Typography>
      )}
    </DialogTitle>
  );
};
