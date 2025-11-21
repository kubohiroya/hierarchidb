import {
  TextField,
  Box,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { TreeConsoleSearchMode } from '../../types.js';

const BASE_SEARCH_FIELD_WIDTH_PX = 300;
const SEARCH_FIELD_WIDTH_PX = Math.round(BASE_SEARCH_FIELD_WIDTH_PX * 1.4);
const SEARCH_FIELD_MIN_WIDTH_PX = Math.round(SEARCH_FIELD_WIDTH_PX * 0.67);
const TREECONSOLE_SEARCH_INPUT_ID = 'treeconsole-toolbar-search-input';
const TREECONSOLE_SEARCH_INPUT_LABEL_ID = 'treeconsole-toolbar-search-input-label';

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
  handleSearchTextChange: (_value: string) => void;
  handleSearchCommit?: () => void;
  fullWidth?: boolean;
  placeholder: string;
  ariaLabel: string;
  searchMode: TreeConsoleSearchMode;
}

export function SearchField({
  searchText,
  handleSearchTextChange,
  handleSearchCommit,
  fullWidth,
  placeholder,
  ariaLabel,
}: SearchFieldProps) {
  return (
    <SearchTextFieldContainer>
      <label
        htmlFor={TREECONSOLE_SEARCH_INPUT_ID}
        id={TREECONSOLE_SEARCH_INPUT_LABEL_ID}
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
        Search tree console
      </label>
      <TextField
        id={TREECONSOLE_SEARCH_INPUT_ID}
        fullWidth={fullWidth}
        size="small"
        placeholder={placeholder}
        value={searchText}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
          handleSearchTextChange(event.target.value)
        }
        onBlur={() => handleSearchCommit?.()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleSearchCommit?.();
          }
        }}
        InputProps={{
          style: {
            width: `${SEARCH_FIELD_WIDTH_PX}px`,
            borderRadius: '30px',
          },
          inputProps: {
            'aria-label': ariaLabel,
            autoComplete: 'new-password',
            name: 'hdb-console-search',
            type: 'search',
            inputMode: 'search',
            spellCheck: false,
            'data-1p-ignore': 'true',
            'data-1p-skip': 'true',
            'data-lpignore': 'true',
            'data-bwignore': 'true',
            'data-form-type': 'other',
            autoCapitalize: 'off',
            autoCorrect: 'off',
          },
        }}
      />
    </SearchTextFieldContainer>
  );
}
