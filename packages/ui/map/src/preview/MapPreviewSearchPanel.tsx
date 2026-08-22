import { Box, IconButton, InputAdornment, Paper, TextField } from '@mui/material';
import type { SxProps } from '@mui/material/styles';
import type { ReactNode } from 'react';
import { useMapPreviewSearchPanelView } from './useMapPreviewSearchPanelView.js';

export type MapPreviewSearchPanelProps = {
  searchText: string;
  onSearchTextChange: (value: string) => void;
  onSearch: () => void;
  onClear: () => void;
  onOpenSettings: () => void;
  onFitScreen?: () => void;
  clearIcon: ReactNode;
  settingsIcon: ReactNode;
  fitScreenIcon?: ReactNode;
  fitScreenDisabled?: boolean;
  showFitScreenButton?: boolean;
  showSettingsButton?: boolean;
  placeholder?: string;
  containerSx?: SxProps;
  panelSx?: SxProps;
};

export const MapPreviewSearchPanel = ({
  searchText,
  onSearchTextChange,
  onSearch,
  onClear,
  onOpenSettings,
  onFitScreen,
  clearIcon,
  settingsIcon,
  fitScreenIcon,
  fitScreenDisabled = false,
  showFitScreenButton = true,
  showSettingsButton = true,
  placeholder = '検索...',
  containerSx,
  panelSx,
}: MapPreviewSearchPanelProps) => {
  const { handleChange, handleKeyDown } = useMapPreviewSearchPanelView({
    onSearchTextChange,
    onSearch,
  });

  return (
    <Box
      sx={{
        position: 'absolute',
        top: 16,
        left: 16,
        zIndex: 200,
        width: 360,
        pointerEvents: 'auto',
        ...containerSx,
      }}
    >
      <Paper elevation={4} sx={{ p: 1, ...panelSx }}>
        <TextField
          fullWidth
          size="small"
          placeholder={placeholder}
          value={searchText}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  aria-label="Clear search"
                  size="small"
                  onClick={onClear}
                  disabled={!searchText.trim()}
                >
                  {clearIcon}
                </IconButton>
                {showFitScreenButton && fitScreenIcon ? (
                  <IconButton
                    aria-label="Fit to selection"
                    size="small"
                    onClick={onFitScreen}
                    disabled={fitScreenDisabled || !onFitScreen}
                  >
                    {fitScreenIcon}
                  </IconButton>
                ) : null}
                {showSettingsButton ? (
                  <IconButton aria-label="Search settings" size="small" onClick={onOpenSettings}>
                    {settingsIcon}
                  </IconButton>
                ) : null}
              </InputAdornment>
            ),
          }}
        />
      </Paper>
    </Box>
  );
};
