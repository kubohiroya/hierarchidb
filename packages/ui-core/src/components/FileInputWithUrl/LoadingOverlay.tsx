import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

interface LoadingOverlayProps {
  isDownloading?: boolean;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ isDownloading = false }) => {
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
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(2px)',
        borderRadius: 1,
        zIndex: 10,
      }}
    >
      <CircularProgress size={24} />
      <Typography variant="caption" sx={{ mt: 1 }}>
        {isDownloading ? 'Downloading...' : 'Loading...'}
      </Typography>
    </Box>
  );
};
