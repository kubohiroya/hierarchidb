import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from 'react/jsx-runtime';
import { Box, CircularProgress, LinearProgress, Typography, useTheme } from '@mui/material';
import { useEffect, useState } from 'react';
import {
  getBackgroundColorForTheme as getThemeBackgroundColor,
  getTextColorForTheme as getThemeTextColor,
} from '../utils/themeUtils';
export function ThemedLoadingScreen({ variant = 'linear', message, size = 40, children }) {
  const [isHydrated, setIsHydrated] = useState(false);
  const theme = useTheme();
  // Use useEffect to ensure we only get theme colors after hydration
  useEffect(() => {
    setIsHydrated(true);
  }, []);
  // Use light theme defaults for SSR, then actual theme after hydration
  const backgroundColor = isHydrated ? getThemeBackgroundColor(theme) : '#fafafa';
  const textColor = isHydrated ? getThemeTextColor(theme) : 'rgba(0, 0, 0, 0.87)';
  return _jsxs(Box, {
    sx: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    children: [
      variant === 'linear'
        ? _jsx(Box, {
            sx: { width: '100%', position: 'absolute', top: 0 },
            children: _jsx(LinearProgress, {
              color: 'primary',
              variant: 'indeterminate',
              'aria-label': 'Loading progress',
            }),
          })
        : _jsxs(_Fragment, {
            children: [
              _jsx(CircularProgress, { size: size, 'aria-label': 'Loading progress' }),
              message &&
                _jsx(Typography, { variant: 'body1', sx: { color: textColor }, children: message }),
            ],
          }),
      children,
    ],
  });
}
export function ThemedLinearProgress() {
  return _jsx(ThemedLoadingScreen, { variant: 'linear' });
}
export function ThemedCircularProgress({ message, size }) {
  return _jsx(ThemedLoadingScreen, { variant: 'circular', message: message, size: size });
}
//# sourceMappingURL=ThemedLoadingScreen.js.map
