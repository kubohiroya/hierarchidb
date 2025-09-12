/**
 * @fileoverview CommonDialogTitle - Standardized base-dialog title component
 */

import React from 'react';
import { Box, Chip, DialogTitle, IconButton, Stack, Typography, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import {
  Close as CloseIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
} from '@mui/icons-material';
// Use existing icon available in our dev/peer range to avoid subpath type issues
import OpenInFullIcon from '@mui/icons-material/OpenInFull';

export interface CommonDialogTitleProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  mode?: 'create' | 'edit';
  nodeId?: string;
  isDraft?: boolean;
  onClose: () => void;
  additionalActions?: React.ReactNode;
  /** Current display mode */
  displayMode?: 'standard' | 'maximized' | 'fullscreen';
  /** Change display mode (standard/maximized/fullscreen) */
  onChangeDisplayMode?: (mode: 'standard' | 'maximized' | 'fullscreen') => void;
  /** Show AspectRatio menu + quick toggles */
  showDisplayModeControls?: boolean;
  /**
   * @deprecated Use `displayMode === 'fullscreen'` and `onChangeDisplayMode('fullscreen'|'standard')`.
   */
  isFullscreen?: boolean;
  /**
   * @deprecated Use `onChangeDisplayMode('fullscreen'|'standard')`.
   */
  toggleFullscreen?: () => void;
}

export const CommonDialogTitle: React.FC<CommonDialogTitleProps> = ({
                                                                       title,
                                                                       subtitle,
                                                                       icon,
                                                                       mode,
                                                                       nodeId,
                                                                       isDraft = false,
                                                                       onClose,
                                                                       displayMode = 'standard',
                                                                       onChangeDisplayMode,
                                                                       showDisplayModeControls = true,
                                                                       isFullscreen,
                                                                       toggleFullscreen,
                                                                    }) => {
  try {
    const allowLegacy = (globalThis as any)?.FEATURE_FLAGS?.UI_DIALOG_ALLOW_LEGACY_DISPLAYMODE;
    const allowLegacyBool = String(allowLegacy ?? 'false').toLowerCase() === 'true' || String(allowLegacy ?? 'false') === '1';
    if (!allowLegacyBool && (typeof toggleFullscreen === 'function' || typeof isFullscreen === 'boolean')) {
      console.warn('[UI] Legacy CommonDialogTitle props (isFullscreen/toggleFullscreen) are disabled by default. Use displayMode/onChangeDisplayMode instead.');
    }
  } catch {}
  const [modeMenuAnchor, setModeMenuAnchor] = React.useState<null | HTMLElement>(null);
  const openModeMenu = (e: React.MouseEvent<HTMLElement>) => setModeMenuAnchor(e.currentTarget);
  const closeModeMenu = () => setModeMenuAnchor(null);
  const selectDisplayMode = (m: 'standard' | 'maximized' | 'fullscreen') => {
    onChangeDisplayMode?.(m);
    closeModeMenu();
  };
  return (
    <DialogTitle>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={2} alignItems="center">
          {icon}
          <Typography variant="h6">{title}</Typography>
          {mode === 'edit' && nodeId && (
            <Typography variant="caption" color="text.secondary">
              ({nodeId})
            </Typography>
          )}
          {isDraft && <Chip label="Draft" size="small" variant="outlined" color="warning" />}
        </Stack>

        <Stack direction="row" spacing={1}>
          {showDisplayModeControls && onChangeDisplayMode && (
            <>
              {/* Display mode menu (Standard / Maximize / Fullscreen) */}
              <IconButton aria-label="Display mode" onClick={openModeMenu} size="small">
                <OpenInFullIcon />
              </IconButton>
              <Menu anchorEl={modeMenuAnchor} open={Boolean(modeMenuAnchor)} onClose={closeModeMenu} keepMounted>
                <MenuItem selected={displayMode === 'standard'} onClick={() => selectDisplayMode('standard')}>
                  <ListItemIcon>
                    <FullscreenExitIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>標準サイズ</ListItemText>
                </MenuItem>
                <MenuItem selected={displayMode === 'maximized'} onClick={() => selectDisplayMode('maximized')}>
                  <ListItemIcon>
                    <OpenInFullIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>最大化（ウィンドウ内）</ListItemText>
                </MenuItem>
                <MenuItem selected={displayMode === 'fullscreen'} onClick={() => selectDisplayMode('fullscreen')}>
                  <ListItemIcon>
                    <FullscreenIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>フルスクリーン</ListItemText>
                </MenuItem>
              </Menu>
              {/* quick toggles */}
              {displayMode !== 'fullscreen' && (
                <IconButton aria-label={displayMode === 'maximized' ? '標準サイズに戻す' : '最大化'} onClick={() => selectDisplayMode(displayMode === 'maximized' ? 'standard' : 'maximized')} size="small">
                  {displayMode === 'maximized' ? <FullscreenExitIcon /> : <OpenInFullIcon />}
                </IconButton>
              )}
              <IconButton aria-label={displayMode === 'fullscreen' ? 'フルスクリーン解除' : 'フルスクリーン'} onClick={() => selectDisplayMode(displayMode === 'fullscreen' ? 'standard' : 'fullscreen')} size="small">
                {displayMode === 'fullscreen' ? <FullscreenExitIcon /> : <FullscreenIcon />}
              </IconButton>
            </>
          )}
          {/* Backward-compat: fullscreen-only button */}
          {!onChangeDisplayMode && (
            <IconButton
              onClick={toggleFullscreen}
              color="inherit"
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              size="small"
            >
              {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
            </IconButton>
          )}
          <IconButton onClick={onClose} color="inherit" aria-label="Close dialog">
            <CloseIcon />
          </IconButton>
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
