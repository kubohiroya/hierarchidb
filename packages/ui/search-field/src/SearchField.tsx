import React from 'react';
import { Box, InputAdornment, TextField } from '@mui/material';
import { styled } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import { useSearchFieldView } from './useSearchFieldView.js';

const BASE_SEARCH_FIELD_WIDTH_PX = 300;
export const SEARCH_FIELD_WIDTH_PX = Math.round(BASE_SEARCH_FIELD_WIDTH_PX * 1.4);
export const SEARCH_FIELD_MIN_WIDTH_PX = Math.round(SEARCH_FIELD_WIDTH_PX * 0.67);
const SEARCH_INPUT_ID = 'ui-search-field-input';
const SEARCH_INPUT_LABEL_ID = 'ui-search-field-input-label';

const SearchTextFieldContainer = styled(Box)(() => ({
  display: 'flex',
  alignItems: 'center',
  borderBottom: 1,
  borderColor: 'divider',
  backgroundColor: 'background.paper',
  minWidth: `${SEARCH_FIELD_MIN_WIDTH_PX}px`,
  width: `${SEARCH_FIELD_WIDTH_PX}px`,
  borderRadius: '24px',
}));

export interface SearchFieldProps {
  searchText: string;
  handleSearchTextChange: (value: string) => void;
  handleSearchCommit?: () => void;
  fullWidth?: boolean;
  placeholder: string;
  ariaLabel: string;
  /** Optional search mode hint for consumers; not used internally */
  searchMode?: string;
}

export function SearchField({
  searchText,
  handleSearchTextChange,
  handleSearchCommit,
  fullWidth,
  placeholder,
  ariaLabel,
}: SearchFieldProps): React.JSX.Element {
  const { handleChange, handleBlur, handleKeyDown, inputProps } = useSearchFieldView({
    ariaLabel,
    handleSearchTextChange,
    handleSearchCommit,
  });

  return (
    <SearchTextFieldContainer>
      <label
        htmlFor={SEARCH_INPUT_ID}
        id={SEARCH_INPUT_LABEL_ID}
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          border: 0,
        }}
      >
        Search
      </label>
      <TextField
        id={SEARCH_INPUT_ID}
        fullWidth={fullWidth}
        size="small"
        placeholder={placeholder}
        value={searchText}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
          style: {
            width: `${SEARCH_FIELD_WIDTH_PX}px`,
            borderRadius: '30px',
          },
          inputProps,
        }}
      />
    </SearchTextFieldContainer>
  );
}
