import React from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  LinearProgress,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { CheckCircle, CloudDownload, Link as LinkIcon } from '@mui/icons-material';
// import { AuthRequiredPrompt } from "@/shared/auth/components/AuthProviderPrompt";
// import { AuthProviderType } from "@/shared/auth/types/AuthProviderType.ts";

interface UrlDownloadSectionProps {
  downloadUrl: string;
  isDownloading: boolean;
  disabled: boolean;
  loading: boolean;
  downloadError: string | undefined;
  downloadProgress: number | undefined;
  downloadSuccess: boolean;
  isAuthError: boolean;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  hoveredSection: 'drag' | 'url' | undefined;
  onUrlChange: (url: string) => void;
  handleDownload: () => void;
  onKeyPress: (event: React.KeyboardEvent) => void;
  onSignIn?: (provider?: any /*AuthProviderType*/) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  compact?: boolean;
}

export const UrlDownloadSection: React.FC<UrlDownloadSectionProps> = ({
  downloadUrl,
  isDownloading,
  disabled,
  loading,
  downloadError,
  downloadProgress,
  downloadSuccess,
  isAuthError,
  isAuthenticated,
  // isLoadingAuth,
  hoveredSection,
  onUrlChange,
  handleDownload,
  onKeyPress,
  // onSignIn,
  onMouseEnter,
  onMouseLeave,
  compact = false,
}) => {
  // Check if URL is populated but download hasn't been executed
  const hasUrlNotDownloaded =
    downloadUrl.trim() && !downloadSuccess && !isDownloading && !downloadError;

  return (
    <Paper
      elevation={0}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      sx={{
        p: compact ? 2 : 3,
        backgroundColor: (theme) => (theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50'),
        border: 1,
        borderColor: (theme) => (theme.palette.mode === 'dark' ? 'grey.700' : 'grey.300'),
        borderRadius: 2,
        transition: 'opacity 0.2s ease',
        opacity: hoveredSection === 'drag' ? 0.4 : 1,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: compact ? 1 : 2 }}>
        <LinkIcon
          sx={{
            mr: 1,
            color: 'text.secondary',
            fontSize: compact ? '1rem' : '1.5rem',
          }}
        />
        <Typography variant={compact ? 'body1' : 'subtitle1'} fontWeight={500}>
          Download from URL
        </Typography>
      </Box>

      {/* Show login prompt if authentication error occurred */}
      {isAuthError && !isAuthenticated ? (
        <Alert severity="info">Please sign in to download data from external sources</Alert>
      ) : (
        <>
          {/* URL input and download button in horizontal layout */}
          <Box
            sx={{
              display: 'flex',
              gap: compact ? 1 : 2,
              mb: downloadProgress !== null ? (compact ? 0.5 : 1) : compact ? 1 : 2,
            }}
          >
            <TextField
              fullWidth
              label="File URL"
              placeholder="https://example.com/data.csv"
              value={downloadUrl}
              onChange={(e) => onUrlChange(e.target.value)}
              onKeyPress={onKeyPress}
              disabled={disabled || loading || isDownloading}
              size={compact ? 'small' : 'medium'}
              sx={{
                flex: 1,
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                },
                '& .MuiInputLabel-root': {
                  fontSize: compact ? '0.875rem' : '1rem',
                },
              }}
              InputProps={{
                startAdornment: <LinkIcon sx={{ mr: 1, color: 'action.active' }} />,
                endAdornment: downloadSuccess ? (
                  <CheckCircle sx={{ color: 'success.main' }} />
                ) : null,
              }}
            />

            <Button
              variant="contained"
              color={hasUrlNotDownloaded ? 'warning' : 'primary'}
              size={compact ? 'medium' : 'large'}
              startIcon={
                isDownloading ? (
                  <CircularProgress
                    size={compact ? 16 : 20}
                    color="inherit"
                    aria-label="Downloading"
                  />
                ) : (
                  <CloudDownload />
                )
              }
              onClick={handleDownload}
              disabled={
                !downloadUrl.trim() ||
                disabled ||
                loading ||
                isDownloading ||
                (isAuthError && !isAuthenticated) ||
                (downloadError?.includes('Authentication required') && !isAuthenticated)
              }
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                px: compact ? 2 : 3,
                minWidth: compact ? 120 : 160,
                fontSize: compact ? '0.875rem' : '1rem',
              }}
            >
              {isDownloading ? 'Downloading...' : compact ? 'Download' : 'Download from URL'}
            </Button>
          </Box>

          {/* Download progress */}
          {downloadProgress !== null && (
            <Box sx={{ mb: compact ? 1 : 2 }}>
              <LinearProgress
                variant="determinate"
                value={downloadProgress ?? 0}
                sx={{
                  height: compact ? 4 : 6,
                  borderRadius: 3,
                }}
                aria-label={`Download progress: ${downloadProgress}%`}
              />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  mt: 0.5,
                  display: 'block',
                  fontSize: compact ? '0.75rem' : '0.875rem',
                }}
              >
                Downloading... {downloadProgress}%
              </Typography>
            </Box>
          )}

          {/* Show error if download failed, otherwise show warning/info based on state */}
          {downloadError ? (
            <Alert severity="error" variant="outlined" sx={{ backgroundColor: 'transparent' }}>
              <Typography variant="caption" sx={{ fontSize: compact ? '0.75rem' : '0.875rem' }}>
                {downloadError}
              </Typography>
            </Alert>
          ) : hasUrlNotDownloaded ? (
            <Alert severity="warning" variant="outlined" sx={{ backgroundColor: 'transparent' }}>
              <Typography variant="caption" sx={{ fontSize: compact ? '0.75rem' : '0.875rem' }}>
                Press the &apos;Download remote file&apos; button, then press the &apos;Next&apos;
                button
              </Typography>
            </Alert>
          ) : (
            <Alert severity="info" variant="outlined" sx={{ backgroundColor: 'transparent' }}>
              <Typography variant="caption" sx={{ fontSize: compact ? '0.75rem' : '0.875rem' }}>
                Note: The URL must be CORS-enabled or accessible through our proxy service.
                Authentication may be required for external sources.
              </Typography>
            </Alert>
          )}
        </>
      )}
    </Paper>
  );
};
