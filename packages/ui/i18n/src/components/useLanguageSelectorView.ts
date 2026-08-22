import type { SelectChangeEvent } from '@mui/material';
import { useCallback } from 'react';
import type { LanguageConfig } from '~/provider/LanguageProvider';

export interface UseLanguageSelectorViewParams {
  showNativeNames: boolean;
  changeLanguage: (languageCode: string) => void;
}

export interface UseLanguageSelectorViewResult {
  handleChange: (event: SelectChangeEvent<string>) => void;
  getLanguageLabelText: (lang: LanguageConfig) => string;
}

export function useLanguageSelectorView({
  showNativeNames,
  changeLanguage,
}: UseLanguageSelectorViewParams): UseLanguageSelectorViewResult {
  const handleChange = useCallback(
    (event: SelectChangeEvent<string>) => {
      changeLanguage(event.target.value);
    },
    [changeLanguage]
  );

  const getLanguageLabelText = useCallback(
    (lang: LanguageConfig) => (showNativeNames ? lang.nativeName : lang.name),
    [showNativeNames]
  );

  return {
    handleChange,
    getLanguageLabelText,
  };
}
