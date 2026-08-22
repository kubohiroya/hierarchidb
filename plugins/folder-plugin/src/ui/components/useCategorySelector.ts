import { useCallback, useMemo } from 'react';
import type { CategoryOption } from './CategorySelector.tsx';

interface UseCategorySelectorProps<T extends string> {
  value: T | null;
  options: CategoryOption<T>[];
  onChange: (category: T) => void;
  disabled: boolean;
}

export function useCategorySelector<T extends string>({
  value,
  options,
  onChange,
  disabled,
}: UseCategorySelectorProps<T>) {
  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value) ?? null,
    [options, value]
  );

  const handleSelect = useCallback(
    (nextValue: T) => {
      if (disabled) return;
      onChange(nextValue);
    },
    [disabled, onChange]
  );

  return { handleSelect, selectedOption };
}
