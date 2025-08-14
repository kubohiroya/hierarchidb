import React from 'react';
import { Box, TextField, Button } from '@mui/material';

interface UrlDownloadSectionProps {
  url: string;
  onUrlChange: (url: string) => void;
  onDownload: () => void;
  loading?: boolean;
  compact?: boolean;
  onSignIn?: (provider?: any) => void;
  onKeyPress?: (e: React.KeyboardEvent) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export const UrlDownloadSection: React.FC<UrlDownloadSectionProps> = ({
  url,
  onUrlChange,
  onDownload,
  loading = false,
  compact = false,
  onKeyPress,
  onMouseEnter,
  onMouseLeave,
}) => {
  return (
    <Box
      sx={{ display: 'flex', gap: 1, alignItems: 'center' }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <TextField
        value={url}
        onChange={(e) => onUrlChange(e.target.value)}
        placeholder="Enter URL"
        size={compact ? 'small' : 'medium'}
        onKeyPress={onKeyPress}
        sx={{ flex: 1 }}
      />
      <Button
        onClick={onDownload}
        disabled={loading || !url}
        variant="outlined"
        size={compact ? 'small' : 'medium'}
      >
        {loading ? 'Loading...' : 'Download'}
      </Button>
    </Box>
  );
};
