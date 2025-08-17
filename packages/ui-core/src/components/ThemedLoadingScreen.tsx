import { Box, CircularProgress, LinearProgress, Typography } from '@mui/material';
import { ReactNode, useEffect, useState } from 'react';
// import { ThemeMode } from '@hierarchidb/ui-theme';
type ThemeMode = 'light' | 'dark' | 'system';

interface ThemedLoadingScreenProps {
  variant?: 'linear' | 'circular';
  message?: string;
  size?: number;
  children?: ReactNode;
}

const THEME_STORAGE_KEY = 'app-theme-mode';

export const getStoredThemeMode = (): ThemeMode => {
  if (typeof window === 'undefined') return 'system';

  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && (stored === 'system' || stored === 'light' || stored === 'dark')) {
      return stored as ThemeMode;
    }
  } catch {
    // Silently fail
  }

  return 'system';
};

export const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light';
  if (!window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const getActualTheme = (): 'light' | 'dark' => {
  const themeMode = getStoredThemeMode();
  return themeMode === 'system' ? getSystemTheme() : themeMode;
};

export const getThemeBackgroundColor = (): string => {
  // Always return light theme colors during SSR to prevent hydration mismatch
  if (typeof window === 'undefined') {
    return '#fafafa'; // Light theme background
  }

  const theme = getActualTheme();
  return theme === 'dark' ? '#121212' : '#fafafa';
};

export const getThemeTextColor = (): string => {
  // Always return light theme colors during SSR to prevent hydration mismatch
  if (typeof window === 'undefined') {
    return 'rgba(0, 0, 0, 0.87)'; // Light theme text
  }

  const theme = getActualTheme();
  return theme === 'dark' ? 'rgba(255, 255, 255, 0.87)' : 'rgba(0, 0, 0, 0.87)';
};

export function ThemedLoadingScreen({
  variant = 'linear',
  message,
  size = 40,
  children,
}: ThemedLoadingScreenProps) {
  const [isHydrated, setIsHydrated] = useState(false);

  // Use useEffect to ensure we only get theme colors after hydration
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Use light theme defaults for SSR, then actual theme after hydration
  const backgroundColor = isHydrated ? getThemeBackgroundColor() : '#fafafa';
  const textColor = isHydrated ? getThemeTextColor() : 'rgba(0, 0, 0, 0.87)';

  return (
    <Box
      sx={{
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
      }}
    >
      {variant === 'linear' ? (
        <Box sx={{ width: '100%', position: 'absolute', top: 0 }}>
          <LinearProgress color="primary" variant="indeterminate" aria-label="Loading progress" />
        </Box>
      ) : (
        <>
          <CircularProgress size={size} aria-label="Loading progress" />
          {message && (
            <Typography variant="body1" sx={{ color: textColor }}>
              {message}
            </Typography>
          )}
        </>
      )}
      {children}
    </Box>
  );
}

export function ThemedLinearProgress() {
  return <ThemedLoadingScreen variant="linear" />;
}

export function ThemedCircularProgress({ message, size }: { message?: string; size?: number }) {
  return <ThemedLoadingScreen variant="circular" message={message} size={size} />;
}
