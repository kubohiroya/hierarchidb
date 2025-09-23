import { memo } from 'react';
import { TextField, InputAdornment, IconButton, type SxProps, type Theme } from '@mui/material';
import { Search as SearchIcon, Clear as ClearIcon } from '@mui/icons-material';

export interface TreeTableSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder?: string;
  label?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  sx?: SxProps<Theme>;
}

export const TreeTableSearchInput = memo(function TreeTableSearchInput(
  props: TreeTableSearchInputProps,
): React.JSX.Element {
  const {
    value,
    onChange,
    onClear,
    placeholder = 'Search...',
    label,
    autoFocus = false,
    disabled = false,
    sx,
  } = props;

  return (
    <TextField
      size="small"
      placeholder={placeholder}
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      autoFocus={autoFocus}
      disabled={disabled}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon fontSize="small" />
          </InputAdornment>
        ),
        endAdornment: value ? (
          <InputAdornment position="end">
            <IconButton size="small" onClick={onClear} aria-label="Clear search">
              <ClearIcon fontSize="small" />
            </IconButton>
          </InputAdornment>
        ) : undefined,
      }}
      sx={sx}
    />
  );
});
