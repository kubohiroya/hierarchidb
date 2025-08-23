import React from 'react';
import { BaseAccordion, BaseAccordionProps } from './BaseAccordion';
import { useTheme } from '@mui/material';

export type AccordionVariant = 'default' | 'outlined' | 'filled' | 'elevated';
export type AccordionColorScheme = 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';

export interface StyledAccordionProps extends Omit<BaseAccordionProps, 'headerBackgroundColor' | 'headerTextColor' | 'elevation'> {
  /** Visual variant of the accordion */
  variant?: AccordionVariant;
  /** Color scheme to apply */
  colorScheme?: AccordionColorScheme;
  /** Custom color (overrides colorScheme) */
  customColor?: string;
  /** Whether to use gradient background */
  gradient?: boolean;
  /** Border radius style */
  borderRadius?: 'none' | 'small' | 'medium' | 'large';
  /** Padding size */
  padding?: 'none' | 'small' | 'medium' | 'large';
}

const paddingSizes = {
  none: 0,
  small: 1,
  medium: 2,
  large: 3,
};

const borderRadiusValues = {
  none: 0,
  small: 1,
  medium: 2,
  large: 3,
};

/**
 * Styled accordion with predefined visual variants
 */
export const StyledAccordion: React.FC<StyledAccordionProps> = ({
  variant = 'default',
  colorScheme = 'default',
  customColor,
  gradient = false,
  borderRadius = 'medium',
  padding = 'medium',
  ...baseProps
}) => {
  const theme = useTheme();

  // Determine colors based on variant and color scheme
  const getColors = () => {
    if (customColor) {
      return {
        backgroundColor: customColor,
        textColor: theme.palette.getContrastText(customColor),
      };
    }

    const isDark = theme.palette.mode === 'dark';

    switch (variant) {
      case 'outlined':
        return {
          backgroundColor: 'transparent',
          textColor: theme.palette.text.primary,
          border: `1px solid ${theme.palette.divider}`,
        };
      
      case 'filled':
        const schemeColors = {
          default: isDark ? theme.palette.grey[800] : theme.palette.grey[100],
          primary: theme.palette.primary.main,
          secondary: theme.palette.secondary.main,
          success: theme.palette.success.main,
          warning: theme.palette.warning.main,
          error: theme.palette.error.main,
          info: theme.palette.info.main,
        };
        const bgColor = schemeColors[colorScheme];
        return {
          backgroundColor: gradient 
            ? `linear-gradient(135deg, ${bgColor}, ${theme.palette.augmentColor({ color: { main: bgColor } }).dark})`
            : bgColor,
          textColor: colorScheme === 'default' 
            ? theme.palette.text.primary 
            : theme.palette.getContrastText(bgColor),
        };
      
      case 'elevated':
        return {
          backgroundColor: theme.palette.background.paper,
          textColor: theme.palette.text.primary,
          elevation: 3,
        };
      
      default:
        return {
          backgroundColor: theme.palette.background.default,
          textColor: theme.palette.text.primary,
        };
    }
  };

  const colors = getColors();

  return (
    <BaseAccordion
      {...baseProps}
      headerBackgroundColor={colors.backgroundColor}
      headerTextColor={colors.textColor}
      elevation={variant === 'elevated' ? colors.elevation || 3 : 0}
      sx={{
        borderRadius: borderRadiusValues[borderRadius],
        border: colors.border,
        overflow: 'hidden',
        ...baseProps.sx,
      }}
      contentSx={{
        padding: paddingSizes[padding],
        ...baseProps.contentSx,
      }}
    />
  );
};