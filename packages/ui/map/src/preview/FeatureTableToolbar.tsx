import type React from 'react';
import { Box, IconButton, InputAdornment, TextField, Typography } from '@mui/material';
import { Close as CloseIcon, MoreVert as MoreVertIcon, Search as SearchIcon } from '@mui/icons-material';
import { useFeatureTableToolbarView } from './useFeatureTableToolbarView.js';

export type FeatureTableSearchConfig = {
  value: string;
  onChange: (value: string) => void;
  onCommit?: () => void;
  placeholder?: string;
  ariaLabel?: string;
};

export type FeatureTableToolbarProps = {
  title?: string;
  showTitle?: boolean;
  search?: FeatureTableSearchConfig;
  toolbarActions?: React.ReactNode;
  enableColumnSelector?: boolean;
  onOpenColumnSelector?: () => void;
  countText?: string;
};

export const FeatureTableToolbar: React.FC<FeatureTableToolbarProps> = ({
  title,
  showTitle = false,
  search,
  toolbarActions,
  enableColumnSelector = true,
  onOpenColumnSelector,
  countText,
}) => {
  const { handleClearSearch, handleSearchChange, handleSearchKeyDown } = useFeatureTableToolbarView(search);

  return (
    <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
    {showTitle && title ? <Typography variant="subtitle2">{title}</Typography> : null}
    {search ? (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <TextField
          size="small"
          value={search.value}
          onChange={(event) => handleSearchChange(event.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder={search.placeholder}
          inputProps={{ 'aria-label': search.ariaLabel }}
          fullWidth
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 999,
              paddingLeft: 0,
            },
            '& .MuiOutlinedInput-input': {
              paddingLeft: 0,
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" color="action" sx={{ ml: 2 }} />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  aria-label="Clear search"
                  size="small"
                  onClick={handleClearSearch}
                  disabled={!search.value.trim()}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
        {toolbarActions ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {toolbarActions}
          </Box>
        ) : null}
        {enableColumnSelector ? (
          <IconButton
            aria-label="Select columns"
            size="small"
            onClick={onOpenColumnSelector}
            disabled={!onOpenColumnSelector}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
        ) : null}
      </Box>
    ) : null}
    {countText ? (
      <Typography variant="body2" color="text.secondary">
        {countText}
      </Typography>
    ) : null}
  </Box>
  );
};
