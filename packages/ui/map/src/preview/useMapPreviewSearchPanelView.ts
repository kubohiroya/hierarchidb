import { useCallback } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';

type UseMapPreviewSearchPanelViewArgs = {
  onSearchTextChange: (value: string) => void;
  onSearch: () => void;
};

export const useMapPreviewSearchPanelView = ({
  onSearchTextChange,
  onSearch,
}: UseMapPreviewSearchPanelViewArgs) => {
  const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    onSearchTextChange(event.target.value);
  }, [onSearchTextChange]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    onSearch();
  }, [onSearch]);

  return {
    handleChange,
    handleKeyDown,
  };
};
