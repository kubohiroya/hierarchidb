import { Box, CircularProgress, LinearProgress, Typography, useTheme } from '@mui/material';
import { ReactNode, useEffect, useState } from 'react';
import { getBackgroundColorForTheme, getTextColorForTheme } from '@hierarchidb/ui-theme';

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
  const theme = useTheme();

  // Use useEffect to ensure we only get theme colors after hydration
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Use light theme defaults for SSR, then actual theme after hydration
  const backgroundColor = isHydrated ? getBackgroundColorForTheme(theme) : '#fafafa';
  const textColor = isHydrated ? getTextColorForTheme(theme) : 'rgba(0, 0, 0, 0.87)';

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
