import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from 'react/jsx-runtime';
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
export const UrlDownloadSection = ({
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
  return _jsxs(Paper, {
    elevation: 0,
    onMouseEnter: onMouseEnter,
    onMouseLeave: onMouseLeave,
    sx: {
      p: compact ? 2 : 3,
      backgroundColor: (theme) => (theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50'),
      border: 1,
      borderColor: (theme) => (theme.palette.mode === 'dark' ? 'grey.700' : 'grey.300'),
      borderRadius: 2,
      transition: 'opacity 0.2s ease',
      opacity: hoveredSection === 'drag' ? 0.4 : 1,
    },
    children: [
      _jsxs(Box, {
        sx: { display: 'flex', alignItems: 'center', mb: compact ? 1 : 2 },
        children: [
          _jsx(LinkIcon, {
            sx: {
              mr: 1,
              color: 'text.secondary',
              fontSize: compact ? '1rem' : '1.5rem',
            },
          }),
          _jsx(Typography, {
            variant: compact ? 'body1' : 'subtitle1',
            fontWeight: 500,
            children: 'Download from URL',
          }),
        ],
      }),
      isAuthError && !isAuthenticated
        ? _jsx(Alert, {
            severity: 'info',
            children: 'Please sign in to download data from external sources',
          })
        : _jsxs(_Fragment, {
            children: [
              _jsxs(Box, {
                sx: {
                  display: 'flex',
                  gap: compact ? 1 : 2,
                  mb: downloadProgress !== null ? (compact ? 0.5 : 1) : compact ? 1 : 2,
                },
                children: [
                  _jsx(TextField, {
                    fullWidth: true,
                    label: 'File URL',
                    placeholder: 'https://example.com/data.csv',
                    value: downloadUrl,
                    onChange: (e) => onUrlChange(e.target.value),
                    onKeyPress: onKeyPress,
                    disabled: disabled || loading || isDownloading,
                    size: compact ? 'small' : 'medium',
                    sx: {
                      flex: 1,
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                      },
                      '& .MuiInputLabel-root': {
                        fontSize: compact ? '0.875rem' : '1rem',
                      },
                    },
                    InputProps: {
                      startAdornment: _jsx(LinkIcon, { sx: { mr: 1, color: 'action.active' } }),
                      endAdornment: downloadSuccess
                        ? _jsx(CheckCircle, { sx: { color: 'success.main' } })
                        : null,
                    },
                  }),
                  _jsx(Button, {
                    variant: 'contained',
                    color: hasUrlNotDownloaded ? 'warning' : 'primary',
                    size: compact ? 'medium' : 'large',
                    startIcon: isDownloading
                      ? _jsx(CircularProgress, {
                          size: compact ? 16 : 20,
                          color: 'inherit',
                          'aria-label': 'Downloading',
                        })
                      : _jsx(CloudDownload, {}),
                    onClick: handleDownload,
                    disabled:
                      !downloadUrl.trim() ||
                      disabled ||
                      loading ||
                      isDownloading ||
                      (isAuthError && !isAuthenticated) ||
                      (downloadError?.includes('Authentication required') && !isAuthenticated),
                    sx: {
                      borderRadius: 2,
                      textTransform: 'none',
                      px: compact ? 2 : 3,
                      minWidth: compact ? 120 : 160,
                      fontSize: compact ? '0.875rem' : '1rem',
                    },
                    children: isDownloading
                      ? 'Downloading...'
                      : compact
                        ? 'Download'
                        : 'Download from URL',
                  }),
                ],
              }),
              downloadProgress !== null &&
                _jsxs(Box, {
                  sx: { mb: compact ? 1 : 2 },
                  children: [
                    _jsx(LinearProgress, {
                      variant: 'determinate',
                      value: downloadProgress ?? 0,
                      sx: {
                        height: compact ? 4 : 6,
                        borderRadius: 3,
                      },
                      'aria-label': `Download progress: ${downloadProgress}%`,
                    }),
                    _jsxs(Typography, {
                      variant: 'caption',
                      color: 'text.secondary',
                      sx: {
                        mt: 0.5,
                        display: 'block',
                        fontSize: compact ? '0.75rem' : '0.875rem',
                      },
                      children: ['Downloading... ', downloadProgress, '%'],
                    }),
                  ],
                }),
              downloadError
                ? _jsx(Alert, {
                    severity: 'error',
                    variant: 'outlined',
                    sx: { backgroundColor: 'transparent' },
                    children: _jsx(Typography, {
                      variant: 'caption',
                      sx: { fontSize: compact ? '0.75rem' : '0.875rem' },
                      children: downloadError,
                    }),
                  })
                : hasUrlNotDownloaded
                  ? _jsx(Alert, {
                      severity: 'warning',
                      variant: 'outlined',
                      sx: { backgroundColor: 'transparent' },
                      children: _jsx(Typography, {
                        variant: 'caption',
                        sx: { fontSize: compact ? '0.75rem' : '0.875rem' },
                        children:
                          "Press the 'Download remote file' button, then press the 'Next' button",
                      }),
                    })
                  : _jsx(Alert, {
                      severity: 'info',
                      variant: 'outlined',
                      sx: { backgroundColor: 'transparent' },
                      children: _jsx(Typography, {
                        variant: 'caption',
                        sx: { fontSize: compact ? '0.75rem' : '0.875rem' },
                        children:
                          'Note: The URL must be CORS-enabled or accessible through our proxy service. Authentication may be required for external sources.',
                      }),
                    }),
            ],
          }),
    ],
  });
};
//# sourceMappingURL=UrlDownloadSection.js.map
