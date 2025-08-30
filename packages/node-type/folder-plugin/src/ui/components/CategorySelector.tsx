/**
 * CategorySelector Component
 * カテゴリ選択のためのUIコンポーネント
 */

import React from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Chip,
  ListItemIcon,
  ListItemText,
  FormHelperText
} from '@mui/material';
import { Category as CategoryIcon } from '@mui/icons-material';

export interface CategoryOption<T extends string> {
  /** 内部値（ブランド型） */
  value: T;
  /** 表示名 */
  label: string;
  /** 説明 */
  description?: string;
  /** アイコン */
  icon?: React.ReactNode;
  /** 色 */
  color?: string;
  /** 無効化フラグ */
  disabled?: boolean;
}

export interface CategorySelectorProps<T extends string> {
  /** 選択済みカテゴリ */
  value: T | null;
  /** カテゴリ変更コールバック */
  onChange: (category: T) => void;
  /** 選択肢定義 */
  options: CategoryOption<T>[];
  /** ラベル */
  label?: string;
  /** プレースホルダー */
  placeholder?: string;
  /** 必須フィールド */
  required?: boolean;
  /** 無効化フラグ */
  disabled?: boolean;
  /** エラー状態 */
  error?: boolean;
  /** ヘルプテキスト */
  helperText?: string;
  /** 表示モード */
  variant?: 'select' | 'chips';
  /** フルウィズス */
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
  fullWidth = true
}: CategorySelectorProps<T>) => {
  
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
              icon={option.icon ? (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  {option.icon}
                </Box>
              ) : undefined}
              onClick={() => !disabled && !option.disabled && onChange(option.value)}
              variant={value === option.value ? 'filled' : 'outlined'}
              color={value === option.value ? 'primary' : 'default'}
              disabled={disabled || option.disabled}
              sx={{
                ...(option.color && {
                  backgroundColor: value === option.value ? option.color : undefined,
                  borderColor: option.color,
                  '&:hover': {
                    backgroundColor: value === option.value 
                      ? option.color 
                      : `${option.color}20`
                  }
                })
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
    <FormControl 
      fullWidth={fullWidth} 
      required={required}
      error={error}
      disabled={disabled}
    >
      <InputLabel id={`category-select-label-${label}`}>
        {label}
      </InputLabel>
      <Select
        labelId={`category-select-label-${label}`}
        value={value || ''}
        onChange={(e) => onChange(e.target.value as T)}
        label={label}
        displayEmpty
        renderValue={(selected) => {
          if (!selected) {
            return (
              <Typography color="text.secondary">
                {placeholder}
              </Typography>
            );
          }
          
          const option = options.find(opt => opt.value === selected);
          if (!option) return selected;
          
          return (
            <Box display="flex" alignItems="center" gap={1}>
              {option.icon && (
                <Box 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    color: option.color 
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
                    backgroundColor: option.color
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
          <MenuItem 
            key={option.value} 
            value={option.value}
            disabled={option.disabled}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              {option.icon ? (
                <Box sx={{ color: option.color }}>
                  {option.icon}
                </Box>
              ) : option.color ? (
                <Box
                  sx={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    backgroundColor: option.color
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
                color: 'text.secondary'
              }}
            />
          </MenuItem>
        ))}
      </Select>
      
      {helperText && (
        <FormHelperText>
          {helperText}
        </FormHelperText>
      )}
    </FormControl>
  );
};