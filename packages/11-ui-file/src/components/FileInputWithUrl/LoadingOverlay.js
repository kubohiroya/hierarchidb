import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { alpha, Box, CircularProgress, Typography, useTheme } from '@mui/material';
export const LoadingOverlay = ({ isDownloading }) => {
  const theme = useTheme();
  return _jsxs(Box, {
    sx: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      // Use theme's background.paper color with transparency
      backgroundColor: alpha(theme.palette.background.paper, 0.9),
      backdropFilter: 'blur(2px)',
      zIndex: 100,
    },
    children: [
      _jsx(CircularProgress, {
        size: 48,
        'aria-label': isDownloading ? 'Downloading file' : 'Processing',
      }),
      _jsx(Typography, {
        variant: 'body1',
        sx: { mt: 2 },
        children: isDownloading ? 'Downloading file...' : 'Processing...',
      }),
    ],
  });
};
//# sourceMappingURL=LoadingOverlay.js.map
