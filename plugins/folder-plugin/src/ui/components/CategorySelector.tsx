/**
 * CategorySelector Component
 * UI
 */

import { Category as CategoryIcon } from '@mui/icons-material';
import {
  Box,
  Chip,
  FormControl,
  FormHelperText,
  InputLabel,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import type React from 'react';
import { useCategorySelector } from './useCategorySelector.js';

export interface CategoryOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  color?: string;
  disabled?: boolean;
}

export interface CategorySelectorProps<T extends string> {
  value: T | null;
  onChange: (category: T) => void;
  options: CategoryOption<T>[];
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  variant?: 'select' | 'chips';
  fullWidth?: boolean;
}

export const CategorySelector = <T extends string>({
  value,
  onChange,
  options,
  label = 'カテゴリ',
  placeholder = 'カテゴリを選択してください',
  required = false,
  disabled = false,
  error = false,
  helperText,
  variant = 'select',
  fullWidth = true,
}: CategorySelectorProps<T>) => {
  const { handleSelect, selectedOption } = useCategorySelector({
    value,
    options,
    onChange,
    disabled,
  });

  if (variant === 'chips') {
    return (
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          {label}
          {required && <span style={{ color: 'error.main' }}> *</span>}
        </Typography>

        <Box display="flex" flexWrap="wrap" gap={1}>
          {options.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              icon={
                option.icon ? (
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>{option.icon}</Box>
                ) : undefined
              }
              onClick={() => !option.disabled && handleSelect(option.value)}
              variant={value === option.value ? 'filled' : 'outlined'}
              color={value === option.value ? 'primary' : 'default'}
              disabled={disabled || option.disabled}
              sx={{
                ...(option.color && {
                  backgroundColor: value === option.value ? option.color : undefined,
                  borderColor: option.color,
                  '&:hover': {
                    backgroundColor: value === option.value ? option.color : `${option.color}20`,
                  },
                }),
              }}
            />
          ))}
        </Box>

        {helperText && (
          <Typography variant="caption" color={error ? 'error' : 'text.secondary'} sx={{ mt: 1 }}>
            {helperText}
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <FormControl fullWidth={fullWidth} required={required} error={error} disabled={disabled}>
      <InputLabel id={`category-select-label-${label}`}>{label}</InputLabel>
      <Select
        labelId={`category-select-label-${label}`}
        value={value || ''}
        onChange={(e) => handleSelect(e.target.value as T)}
        label={label}
        displayEmpty
        renderValue={(selected) => {
          if (!selected) {
            return <Typography color="text.secondary">{placeholder}</Typography>;
          }

          const option = selectedOption ?? options.find((opt) => opt.value === selected);
          if (!option) return selected;

          return (
            <Box display="flex" alignItems="center" gap={1}>
              {option.icon && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    color: option.color,
                  }}
                >
                  {option.icon}
                </Box>
              )}
              {option.color && (
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    backgroundColor: option.color,
                  }}
                />
              )}
              <Typography>{option.label}</Typography>
            </Box>
          );
        }}
      >
        {!required && (
          <MenuItem value="">
            <em>選択なし</em>
          </MenuItem>
        )}

        {options.map((option) => (
          <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
            <ListItemIcon sx={{ minWidth: 36 }}>
              {option.icon ? (
                <Box sx={{ color: option.color }}>{option.icon}</Box>
              ) : option.color ? (
                <Box
                  sx={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    backgroundColor: option.color,
                  }}
                />
              ) : (
                <CategoryIcon />
              )}
            </ListItemIcon>

            <ListItemText
              primary={option.label}
              secondary={option.description}
              secondaryTypographyProps={{
                variant: 'caption',
                color: 'text.secondary',
              }}
            />
          </MenuItem>
        ))}
      </Select>

      {helperText && <FormHelperText>{helperText}</FormHelperText>}
    </FormControl>
  );
};
