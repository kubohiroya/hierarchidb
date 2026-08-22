import { useCallback, useId, useMemo, useState } from 'react';

export interface UseTagChipsInputParams {
  value: string[];
  onChange?: (tags: string[]) => void;
  maxTags: number;
  suggestions: string[];
}

export interface UseTagChipsInputResult {
  input: string;
  inputId: string;
  labelId: string;
  availableSuggestions: string[];
  setInputValue: (value: string) => void;
  addTag: (tag: string) => void;
  removeTag: (tag: string) => void;
  handleEnterKey: (key: string) => boolean;
}

export function useTagChipsInput({
  value,
  onChange,
  maxTags,
  suggestions,
}: UseTagChipsInputParams): UseTagChipsInputResult {
  const [input, setInput] = useState('');
  const controlId = useId();
  const inputId = `${controlId}-tags`;
  const labelId = `${controlId}-label`;

  const addTag = useCallback(
    (tag: string) => {
      const normalized = tag.trim();
      if (!normalized || value.includes(normalized) || value.length >= maxTags) return;
      onChange?.([...value, normalized]);
      setInput('');
    },
    [maxTags, onChange, value]
  );

  const removeTag = useCallback(
    (tag: string) => {
      onChange?.(value.filter((currentTag) => currentTag !== tag));
    },
    [onChange, value]
  );

  const handleEnterKey = useCallback(
    (key: string): boolean => {
      if (key !== 'Enter') return false;
      addTag(input);
      return true;
    },
    [addTag, input]
  );

  const availableSuggestions = useMemo(
    () => suggestions.filter((suggestion) => suggestion && !value.includes(suggestion)),
    [suggestions, value]
  );

  const setInputValue = useCallback((nextValue: string) => {
    setInput(nextValue);
  }, []);

  return {
    input,
    inputId,
    labelId,
    availableSuggestions,
    setInputValue,
    addTag,
    removeTag,
    handleEnterKey,
  };
}
