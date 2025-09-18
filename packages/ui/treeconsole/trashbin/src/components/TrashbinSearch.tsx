/**
  * TrashbinSearch -
    */

import { InputAdornment, TextField } from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import type { TrashbinSearchProps } from '../types.js';

/**
  * TrashbinSearch
  */
export function TrashbinSearch({
                                 searchText = '',
                                 onSearchChange,
                                 placeholder = 'Search trash items...',
                                 variant = 'outlined',
                                 size = 'small',
                               }: TrashbinSearchProps) {
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onSearchChange?.(event.target.value);
  };

  return (
    <TextField
      fullWidth
      variant={variant}
      size={size}
      placeholder={placeholder}
      value={searchText}
      onChange={handleSearchChange}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon fontSize="small" />
          </InputAdornment>
        ),
      }}
      sx={{
        '& .MuiOutlinedInput-root': {
          backgroundColor: 'background.paper',
        },
      }}
    />
  );
}
