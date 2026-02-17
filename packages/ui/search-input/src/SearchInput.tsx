import { memo, useCallback, useId, type ChangeEvent, type FocusEvent, type KeyboardEvent, type InputHTMLAttributes } from 'react';
import { TextField, InputAdornment, IconButton, type SxProps, type Theme } from '@mui/material';
import { Search as SearchIcon, Close as CloseIcon } from '@mui/icons-material';

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
  const controlId = useId();
  const isLegacyProps =
    typeof searchText === 'string' &&
    typeof handleSearchTextChange === 'function';
  const value = isLegacyProps ? searchText : valueProp;
  const resolvedValue = value ?? '';
  const onValueChange = isLegacyProps ? handleSearchTextChange : onChangeProp;
  const resolvedLabel = isLegacyProps ? undefined : label;
  const resolvedAriaLabel = isLegacyProps ? ariaLabel : label || placeholder || 'Search';
  const resolvedAutoFocus = isLegacyProps ? false : autoFocus;
  const resolvedDisabled = isLegacyProps ? false : disabled;
  const resolvedFullWidth = fullWidth;
  const resolvedCommitMode = isLegacyProps
    ? handleSearchCommit
      ? 'blur-and-enter'
      : 'change'
    : commitModeProp ?? 'change';
  const resolvedOnCommit =
    isLegacyProps
      ? handleSearchCommit === undefined
        ? undefined
        : () => handleSearchCommit()
      : onCommitProp === undefined
        ? undefined
        : (nextValue: string) => onCommitProp(nextValue);
  const resolvedOnBlur = isLegacyProps ? undefined : onBlurProp;
  const resolvedInputProps = isLegacyProps ? undefined : inputProps;
  const resolvedClearHandler = isLegacyProps ? undefined : onClear;
  const inputName = isLegacyProps ? 'hdb-search' : 'tree-table-search';
  const shouldShowClearButton = resolvedValue.length > 0 && resolvedClearHandler !== undefined;

  const mergedInputProps = {
    ...SEARCH_INPUT_DEFAULT_AUTOCOMPLETE_PROPS,
    ...resolvedInputProps,
    'aria-label': resolvedAriaLabel ?? 'Search',
    id: controlId,
    name: inputName,
  } as Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue' | 'onChange'>;

  const mergedSx = [
    {
      minWidth: resolvedFullWidth ? `${SEARCH_FIELD_MIN_WIDTH_PX}px` : undefined,
      width: resolvedFullWidth ? '100%' : `${SEARCH_FIELD_WIDTH_PX}px`,
      '& .MuiInputBase-root': {
        borderRadius: '30px',
      },
      '& input::-webkit-search-cancel-button': {
        display: 'none',
      },
      '& input::-webkit-search-decoration': {
        display: 'none',
      },
    },
    sx,
  ] as SxProps<Theme>;

  const runCommit = useCallback(
    (nextValue: string) => {
      if (
        resolvedOnCommit !== undefined &&
        (resolvedCommitMode === 'blur' ||
          resolvedCommitMode === 'enter' ||
          resolvedCommitMode === 'blur-and-enter')
      ) {
        resolvedOnCommit(nextValue);
      }
    },
    [resolvedCommitMode, resolvedOnCommit],
  );

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value;
      onValueChange?.(nextValue);
      if (resolvedCommitMode === 'change') {
        resolvedOnCommit?.(nextValue);
      }
    },
    [resolvedCommitMode, resolvedOnCommit, onValueChange],
  );

  const handleBlur = useCallback(
    (event: FocusEvent<HTMLInputElement>) => {
      resolvedOnBlur?.();
      if (['blur', 'blur-and-enter'].includes(resolvedCommitMode)) {
        runCommit(event.target.value);
      }
    },
    [resolvedCommitMode, resolvedOnBlur, runCommit],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        if (['enter', 'blur-and-enter'].includes(resolvedCommitMode)) {
          resolvedOnCommit?.(event.currentTarget.value);
        }
      }
    },
    [resolvedCommitMode, resolvedOnCommit],
  );

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
