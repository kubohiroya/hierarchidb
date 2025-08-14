import React from 'react';
import { alpha, Box, CircularProgress, Typography, useTheme } from '@mui/material';

interface LoadingOverlayProps {
  isDownloading: boolean;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ isDownloading }) => {
  const theme = useTheme();

  return (
    <Box
      sx={{
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
      }}
    >
      <CircularProgress size={48} aria-label={isDownloading ? 'Downloading file' : 'Processing'} />
      <Typography variant="body1" sx={{ mt: 2 }}>
        {isDownloading ? 'Downloading file...' : 'Processing...'}
      </Typography>
    </Box>
  );
};
