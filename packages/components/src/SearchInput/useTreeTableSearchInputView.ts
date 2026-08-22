import type { SxProps, Theme } from '@mui/material';
import {
  type ChangeEvent,
  type FocusEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  useCallback,
  useId,
  useRef,
} from 'react';

type SearchFieldCommitMode = 'change' | 'blur' | 'enter' | 'blur-and-enter';

type UseTreeTableSearchInputViewArgs = {
  valueProp?: string;
  onChangeProp?: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  label?: string;
  autoFocus: boolean;
  disabled: boolean;
  fullWidth: boolean;
  searchText?: string;
  handleSearchTextChange?: (value: string) => void;
  handleSearchCommit?: () => void;
  ariaLabel?: string;
  sx?: SxProps<Theme>;
  inputProps?: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue' | 'onChange'>;
  commitModeProp?: SearchFieldCommitMode;
  onCommitProp?: (value: string) => void;
  onBlurProp?: () => void;
  defaultAutocompleteProps: Record<string, string | boolean>;
  searchFieldMinWidthPx: number;
  searchFieldWidthPx: number;
};

export const useTreeTableSearchInputView = ({
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
  defaultAutocompleteProps,
  searchFieldMinWidthPx,
  searchFieldWidthPx,
}: UseTreeTableSearchInputViewArgs) => {
  const controlId = useId();
  const isLegacyProps =
    typeof searchText === 'string' && typeof handleSearchTextChange === 'function';
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
    : (commitModeProp ?? 'change');
  const resolvedOnCommit = isLegacyProps
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
  const inputElementRef = useRef<HTMLInputElement | null>(null);

  const mergedInputProps = {
    ...defaultAutocompleteProps,
    ...resolvedInputProps,
    'aria-label': resolvedAriaLabel ?? 'Search',
    id: controlId,
    name: inputName,
  } as Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue' | 'onChange'>;

  const mergedSx = [
    {
      minWidth: resolvedFullWidth ? `${searchFieldMinWidthPx}px` : undefined,
      width: resolvedFullWidth ? '100%' : `${searchFieldWidthPx}px`,
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
    [resolvedCommitMode, resolvedOnCommit]
  );

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value;
      onValueChange?.(nextValue);
      if (resolvedCommitMode === 'change') {
        resolvedOnCommit?.(nextValue);
      }
    },
    [resolvedCommitMode, resolvedOnCommit, onValueChange]
  );

  const handleBlur = useCallback(
    (event: FocusEvent<HTMLInputElement>) => {
      resolvedOnBlur?.();
      if (['blur', 'blur-and-enter'].includes(resolvedCommitMode)) {
        runCommit(event.target.value);
      }
    },
    [resolvedCommitMode, resolvedOnBlur, runCommit]
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
    [resolvedCommitMode, resolvedOnCommit]
  );

  const focusInputElement = useCallback(() => {
    if (resolvedDisabled) return;
    const inputElement = inputElementRef.current;
    if (!inputElement) return;
    if (document.activeElement === inputElement) return;
    inputElement.focus({ preventScroll: true });
  }, [resolvedDisabled]);

  const handleMouseDownCapture = useCallback(
    (event: MouseEvent) => {
      event.stopPropagation();
      if (event.button === 0) {
        queueMicrotask(() => {
          focusInputElement();
        });
      }
    },
    [focusInputElement]
  );

  const handlePointerDownCapture = useCallback(
    (event: PointerEvent) => {
      event.stopPropagation();
      if (event.button === 0) {
        queueMicrotask(() => {
          focusInputElement();
        });
      }
    },
    [focusInputElement]
  );

  return {
    controlId,
    resolvedValue,
    resolvedLabel,
    resolvedAutoFocus,
    resolvedDisabled,
    resolvedFullWidth,
    placeholder,
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
  };
};
