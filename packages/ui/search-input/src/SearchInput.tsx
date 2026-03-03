import { memo, type InputHTMLAttributes } from 'react';
import { TextField, InputAdornment, IconButton, type SxProps, type Theme } from '@mui/material';
import { Search as SearchIcon, Close as CloseIcon } from '@mui/icons-material';
import { useTreeTableSearchInputView } from './useTreeTableSearchInputView.js';

const BASE_SEARCH_FIELD_WIDTH_PX = 300;
export const SEARCH_FIELD_WIDTH_PX = Math.round(BASE_SEARCH_FIELD_WIDTH_PX * 1.4);
export const SEARCH_FIELD_MIN_WIDTH_PX = Math.round(SEARCH_FIELD_WIDTH_PX * 0.67);

const SEARCH_INPUT_DEFAULT_AUTOCOMPLETE_PROPS = {
  autoComplete: 'new-password',
  autoCapitalize: 'off',
  autoCorrect: 'off',
  'data-1p-ignore': 'true',
  'data-1p-skip': 'true',
  'data-lpignore': 'true',
  'data-bwignore': 'true',
  'data-form-type': 'other',
  inputMode: 'search',
  spellCheck: false,
  type: 'text',
} as const satisfies Record<string, string | boolean>;

type SearchFieldCommitMode = 'change' | 'blur' | 'enter' | 'blur-and-enter';

interface SearchInputBaseProps {
  placeholder?: string;
  label?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  sx?: SxProps<Theme>;
  inputProps?: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue' | 'onChange'>;
  commitMode?: SearchFieldCommitMode;
  onCommit?: (value: string) => void;
  onBlur?: () => void;
}

interface SearchInputControlledProps extends SearchInputBaseProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
}

interface SearchFieldCompatibilityProps extends SearchInputBaseProps {
  searchText: string;
  handleSearchTextChange: (value: string) => void;
  handleSearchCommit?: () => void;
  placeholder: string;
  ariaLabel: string;
  searchMode?: string;
  fullWidth?: boolean;
}

type LegacyProps = SearchFieldCompatibilityProps & {
  value?: never;
  onChange?: never;
  onClear?: never;
};
type NewProps = SearchInputControlledProps & {
  searchText?: never;
  handleSearchTextChange?: never;
  handleSearchCommit?: never;
  ariaLabel?: never;
};
export type TreeTableSearchInputProps = LegacyProps | NewProps;
export type SearchFieldProps = TreeTableSearchInputProps;
export type { SearchFieldCommitMode };

export const TreeTableSearchInput = memo(function TreeTableSearchInput({
  value: valueProp,
  onChange: onChangeProp,
  onClear,
  placeholder,
  label,
  autoFocus = false,
  disabled = false,
  fullWidth = false,
  searchText,
  handleSearchTextChange,
  handleSearchCommit,
  ariaLabel,
  sx,
  inputProps,
  commitMode: commitModeProp,
  onCommit: onCommitProp,
  onBlur: onBlurProp,
}: TreeTableSearchInputProps): React.JSX.Element {
  const {
    controlId,
    resolvedValue,
    resolvedLabel,
    resolvedAutoFocus,
    resolvedDisabled,
    resolvedFullWidth,
    shouldShowClearButton,
    resolvedClearHandler,
    mergedInputProps,
    mergedSx,
    inputElementRef,
    handleChange,
    handleBlur,
    handleKeyDown,
    handleMouseDownCapture,
    handlePointerDownCapture,
  } = useTreeTableSearchInputView({
    valueProp,
    onChangeProp,
    onClear,
    placeholder,
    label,
    autoFocus,
    disabled,
    fullWidth,
    searchText,
    handleSearchTextChange,
    handleSearchCommit,
    ariaLabel,
    sx,
    inputProps,
    commitModeProp,
    onCommitProp,
    onBlurProp,
    defaultAutocompleteProps: SEARCH_INPUT_DEFAULT_AUTOCOMPLETE_PROPS,
    searchFieldMinWidthPx: SEARCH_FIELD_MIN_WIDTH_PX,
    searchFieldWidthPx: SEARCH_FIELD_WIDTH_PX,
  });

  return (
    <TextField
      id={controlId}
      size="small"
      placeholder={placeholder ?? 'Search...'}
      label={resolvedLabel}
      value={resolvedValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      autoFocus={resolvedAutoFocus}
      disabled={resolvedDisabled}
      onMouseDownCapture={handleMouseDownCapture}
      onPointerDownCapture={handlePointerDownCapture}
      inputRef={inputElementRef}
      InputProps={{
        inputProps: mergedInputProps,
        style: {
          width: resolvedFullWidth ? '100%' : `${SEARCH_FIELD_WIDTH_PX}px`,
          borderRadius: '30px',
        },
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon fontSize="small" />
          </InputAdornment>
        ),
        endAdornment: shouldShowClearButton ? (
          <InputAdornment position="end">
            <IconButton
              size="large"
              color="default"
              onClick={() => resolvedClearHandler?.()}
              aria-label="Clear search"
              sx={{
                p: 1,
                minWidth: 36,
                minHeight: 36,
                '& .MuiSvgIcon-root': {
                  fontSize: '1.3rem',
                },
              }}
            >
              <CloseIcon fontSize="large" />
            </IconButton>
          </InputAdornment>
        ) : undefined,
      }}
      sx={mergedSx}
    />
  );
});
