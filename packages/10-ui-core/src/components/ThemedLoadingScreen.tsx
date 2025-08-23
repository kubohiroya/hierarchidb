import { Box, CircularProgress, LinearProgress, Typography, useTheme } from '@mui/material';
import { type ReactNode, useEffect, useState, useMemo } from 'react';
import {
  getThemeBackgroundColor,
  getThemeTextColor,
  getBackgroundColorForTheme,
  getTextColorForTheme,
} from '../utils/theme';

interface ThemedLoadingScreenProps {
  variant?: 'linear' | 'circular';
  message?: string;
  size?: number;
  children?: ReactNode;
}

export function ThemedLoadingScreen({
  variant = 'linear',
  message,
  size = 40,
  children,
}: ThemedLoadingScreenProps) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [themeError, setThemeError] = useState<string | null>(null);
  const theme = useTheme();

  // Performance optimization: Only run hydration effect once
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Performance optimization: Memoize clamped size calculation
  const clampedSize = useMemo(() => Math.max(20, Math.min(200, size)), [size]);

  // Performance optimization: Memoize theme color calculation
  const themeColors = useMemo(() => {
    const fallbackColors = {
      backgroundColor: '#fafafa',
      textColor: 'rgba(0, 0, 0, 0.87)',
    };

    if (!isHydrated) {
      return fallbackColors;
    }

    try {
      if (theme) {
        return {
          backgroundColor: getBackgroundColorForTheme(theme),
          textColor: getTextColorForTheme(theme),
        };
      } else {
        return {
          backgroundColor: getThemeBackgroundColor(),
          textColor: getThemeTextColor(),
        };
      }
    } catch (error) {
      // Log error in development, but fail gracefully in production
      if (process.env.NODE_ENV === 'development') {
        console.warn('[ThemedLoadingScreen] Theme utility error:', error);
        setThemeError(`Theme error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      return fallbackColors;
    }
  }, [isHydrated, theme, themeError]); // themeError in dependencies to avoid stale closure

  // Performance optimization: Memoize primary color fallback
  const primaryColor = useMemo(
    () => theme?.palette?.primary?.main || '#1976d2',
    [theme?.palette?.primary?.main]
  );

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: themeColors.backgroundColor,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
      }}
      role="alert"
      aria-live="polite"
      aria-label={message || 'Application is loading'}
    >
      {variant === 'linear' ? (
        <Box sx={{ width: '100%', position: 'absolute', top: 0 }}>
          <LinearProgress
            color="primary"
            variant="indeterminate"
            aria-label="Loading progress"
            sx={{
              // Ensure progress bar is visible even with theme errors
              '& .MuiLinearProgress-bar': {
                backgroundColor: primaryColor,
              },
            }}
          />
        </Box>
      ) : (
        <>
          <CircularProgress
            size={clampedSize}
            aria-label="Loading progress"
            sx={{
              // Ensure spinner is visible even with theme errors
              color: primaryColor,
            }}
          />
          {message && (
            <Typography
              variant="body1"
              sx={{
                color: themeColors.textColor,
                textAlign: 'center',
                maxWidth: '80%',
                wordBreak: 'break-word',
              }}
            >
              {message}
            </Typography>
          )}
        </>
      )}

      {children}

      {/* Development-only error display */}
      {process.env.NODE_ENV === 'development' && themeError && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            right: 16,
            backgroundColor: 'rgba(244, 67, 54, 0.1)',
            padding: 1,
            borderRadius: 1,
            border: '1px solid rgba(244, 67, 54, 0.3)',
          }}
        >
          <Typography variant="caption" sx={{ color: '#d32f2f', fontFamily: 'monospace' }}>
            {themeError}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

export function ThemedLinearProgress() {
  return <ThemedLoadingScreen variant="linear" />;
}

export function ThemedCircularProgress({ message, size }: { message?: string; size?: number }) {
  return <ThemedLoadingScreen variant="circular" message={message} size={size} />;
}
