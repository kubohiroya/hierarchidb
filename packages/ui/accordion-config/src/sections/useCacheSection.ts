import { useCallback, useId } from 'react';

export interface UseCacheSectionParams {
  onDeleteOnCompleteChange: (checked: boolean) => void;
}

export interface UseCacheSectionResult {
  switchInputProps: {
    id: string;
    name: string;
  };
  onDeleteOnCompleteSwitchChange: (checked: boolean) => void;
}

export function useCacheSection({
  onDeleteOnCompleteChange,
}: UseCacheSectionParams): UseCacheSectionResult {
  const switchId = useId();

  const onDeleteOnCompleteSwitchChange = useCallback(
    (checked: boolean) => {
      onDeleteOnCompleteChange(checked);
    },
    [onDeleteOnCompleteChange]
  );

  return {
    switchInputProps: {
      id: `${switchId}-delete-on-complete`,
      name: 'delete-on-complete',
    },
    onDeleteOnCompleteSwitchChange,
  };
}
