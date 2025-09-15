import React from 'react';
import { Box, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Stack, Typography, Tooltip } from '@mui/material';
import { Close as CloseIcon, Fullscreen as FullscreenIcon, OpenInFull as OpenInFullIcon, CloseFullscreen as CloseFullscreenIcon } from '@mui/icons-material';

export interface MultiStepHeaderShellProps {
  icon?: React.ReactNode;
  title?: React.ReactNode;
  headerActions?: React.ReactNode;
  isFullscreen: boolean;
  isMaximized: boolean;
  openModeMenu: (e: React.MouseEvent<HTMLElement>) => void;
  closeModeMenu: () => void;
  modeMenuAnchor: HTMLElement | null;
  selectDisplayMode: (mode: 'standard' | 'maximized' | 'fullscreen') => void;
  onClose: () => void;
}

export const MultiStepHeaderShell: React.FC<MultiStepHeaderShellProps> = ({
  icon,
  title,
  headerActions,
  isFullscreen,
  isMaximized,
  openModeMenu,
  closeModeMenu,
  modeMenuAnchor,
  selectDisplayMode,
  onClose,
}) => {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, minHeight: 0 }}>
      <Stack direction="row" spacing={2} alignItems="center">
        {icon}
        <Box>
          <Typography variant="subtitle1" sx={{ lineHeight: 1.2 }}>{title}</Typography>
        </Box>
      </Stack>

      <Stack direction="row" spacing={1}>
        {headerActions}
        {/* Display mode button shows current selection; click to open menu */}
        <Tooltip title={isFullscreen ? 'Fullscreen' : (isMaximized ? 'Maximized' : 'Standard')}>
          <IconButton aria-label="Display mode" onClick={openModeMenu} size="small">
            {isFullscreen ? (
              <FullscreenIcon />
            ) : isMaximized ? (
              <OpenInFullIcon />
            ) : (
              <CloseFullscreenIcon />
            )}
          </IconButton>
        </Tooltip>
        <Menu anchorEl={modeMenuAnchor} open={Boolean(modeMenuAnchor)} onClose={closeModeMenu} keepMounted>
          <MenuItem selected={!isFullscreen && !isMaximized} onClick={() => selectDisplayMode('standard')}>
            <ListItemIcon>
              <CloseFullscreenIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>標準サイズ</ListItemText>
          </MenuItem>
          <MenuItem selected={!isFullscreen && isMaximized} onClick={() => selectDisplayMode('maximized')}>
            <ListItemIcon>
              <OpenInFullIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>最大化（ウィンドウ内）</ListItemText>
          </MenuItem>
          <MenuItem selected={isFullscreen} onClick={() => selectDisplayMode('fullscreen')}>
            <ListItemIcon>
              <FullscreenIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>フルスクリーン</ListItemText>
          </MenuItem>
        </Menu>
        <IconButton aria-label="Close" onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Stack>
    </Box>
  );
};
