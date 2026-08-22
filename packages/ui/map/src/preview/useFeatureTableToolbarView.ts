import type { KeyboardEvent } from 'react';
import { useCallback } from 'react';
import type { FeatureTableSearchConfig } from './FeatureTableToolbar.js';

export const useFeatureTableToolbarView = (search?: FeatureTableSearchConfig) => {
  const handleSearchChange = useCallback(
    (value: string) => {
      search?.onChange(value);
    },
    [search]
  );

  const handleSearchKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== 'Enter') return;
      search?.onCommit?.();
    },
    [search]
  );

  const handleClearSearch = useCallback(() => {
    search?.onChange('');
  }, [search]);

  return {
    handleClearSearch,
    handleSearchChange,
    handleSearchKeyDown,
  };
};
