import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import type React from 'react';
import type { LanguageConfig } from '~/provider/LanguageProvider';
import { useLanguage } from '~/provider/LanguageProvider';
import { useLanguageSelectorView } from './useLanguageSelectorView.js';

export interface LanguageSelectorProps {
  variant?: 'dropdown' | 'buttons' | 'compact';
  showFlags?: boolean;
  showNativeNames?: boolean;
  label?: string;
  size?: 'small' | 'medium';
  disabled?: boolean;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  variant = 'dropdown',
  showFlags = true,
  showNativeNames = true,
  label = 'Language',
  size = 'medium',
  disabled = false,
}) => {
  const { currentLanguage, changeLanguage, supportedLanguages } = useLanguage();
  const { handleChange, getLanguageLabelText } = useLanguageSelectorView({
    showNativeNames,
    changeLanguage,
  });

  const renderLanguageLabel = (lang: LanguageConfig) => {
    return (
      <Box display="flex" alignItems="center" gap={1}>
        {showFlags && <span>{lang.flag}</span>}
        <Typography variant="body2">{getLanguageLabelText(lang)}</Typography>
      </Box>
    );
  };

  if (variant === 'dropdown') {
    return (
      <FormControl size={size} disabled={disabled} sx={{ minWidth: 120 }}>
        <InputLabel>{label}</InputLabel>
        <Select value={currentLanguage.code} label={label} onChange={handleChange}>
          {supportedLanguages.map((lang: LanguageConfig) => (
            <MenuItem key={lang.code} value={lang.code}>
              {renderLanguageLabel(lang)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  }

  // Add other variants (buttons, compact) here if needed
  return null;
};
