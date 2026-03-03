import { useCallback, useMemo, type ChangeEvent, type KeyboardEvent } from 'react';
import type { InputBaseComponentProps } from '@mui/material';

export interface UseSearchFieldViewParams {
  ariaLabel: string;
  handleSearchTextChange: (value: string) => void;
  handleSearchCommit?: () => void;
}

export interface UseSearchFieldViewResult {
  handleChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleBlur: () => void;
  handleKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  inputProps: InputBaseComponentProps;
}

export function useSearchFieldView({
  ariaLabel,
  handleSearchTextChange,
  handleSearchCommit,
}: UseSearchFieldViewParams): UseSearchFieldViewResult {
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      handleSearchTextChange(event.target.value);
    },
    [handleSearchTextChange],
  );

  const handleBlur = useCallback(() => {
    handleSearchCommit?.();
  }, [handleSearchCommit]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      handleSearchCommit?.();
    },
    [handleSearchCommit],
  );

  const inputProps = useMemo(
    () => ({
      'aria-label': ariaLabel,
      autoComplete: 'new-password',
      name: 'hdb-search',
      type: 'search' as const,
      inputMode: 'search' as const,
      spellCheck: false,
      'data-1p-ignore': 'true',
      'data-1p-skip': 'true',
      'data-lpignore': 'true',
      'data-bwignore': 'true',
      'data-form-type': 'other',
      autoCapitalize: 'off',
      autoCorrect: 'off',
    }),
    [ariaLabel],
  );

  return {
    handleChange,
    handleBlur,
    handleKeyDown,
    inputProps,
  };
}
