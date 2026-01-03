import type { ChangeEvent } from 'react';
import { Box, IconButton, InputAdornment, Paper, TextField } from '@mui/material';
import { Close as CloseIcon, Tune as TuneIcon } from '@mui/icons-material';

export type SearchPanelProps = {
  searchText: string;
  onSearchTextChange: (value: string) => void;
  onSearch: () => void;
  onClear: () => void;
  onOpenSettings: () => void;
};

export const SearchPanel = ({
  searchText,
  onSearchTextChange,
  onSearch,
  onClear,
  onOpenSettings,
}: SearchPanelProps) => {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onSearchTextChange(event.target.value);
  };

  return (
    <Box
      sx={{
        position: 'absolute',
        top: 16,
        left: 16,
        zIndex: 200,
        width: 360,
        pointerEvents: 'auto',
      }}
    >
      <Paper elevation={4} sx={{ p: 1 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="検索..."
          value={searchText}
          onChange={handleChange}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onSearch();
            }
          }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  aria-label="Clear search"
                  size="small"
                  onClick={onClear}
                  disabled={!searchText.trim()}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
                <IconButton
                  aria-label="Search settings"
                  size="small"
                  onClick={onOpenSettings}
                >
                  <TuneIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
      </Paper>
    </Box>
  );
};
