import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from 'react/jsx-runtime';
import { useState } from 'react';
import { Alert, Box, Button, Chip, Divider, Typography } from '@mui/material';
import { Login } from '@mui/icons-material';
import { devLog, devError } from '../../utils/logger';
import { useDragDrop, useFileInput, useUrlDownload } from './hooks';
import { DragDropSection } from './DragDropSection';
import { UrlDownloadSection } from './UrlDownloadSection';
import { LoadingOverlay } from './LoadingOverlay';
export const FileInputWithUrl = ({
  onFileSelect,
  accept = '*',
  buttonLabel = 'Select File',
  loading = false,
  error = undefined,
  showUrlDownload = true,
  instructions: _instructions,
  disabled = false,
  sx,
  onUrlDownload,
  defaultDownloadUrl,
  onDownloadProgress,
  layout = 'vertical',
}) => {
  const [hoveredSection, setHoveredSection] = useState();
  // Use custom hooks for logic separation
  const { fileInputRef, localError, setLocalError, setDownloadError, handleFileSelect } =
    useFileInput({ onFileSelect });
  const {
    downloadUrl,
    setDownloadUrl,
    isDownloading,
    downloadError,
    downloadProgress,
    downloadSuccess,
    isAuthError,
    handleDownload,
    handleKeyPress,
    isAuthenticated,
    isLoadingAuth,
    signIn,
  } = useUrlDownload({
    accept,
    disabled,
    loading,
    defaultDownloadUrl,
    handleFileSelect: onFileSelect,
    handleUrlDownload: onUrlDownload,
    onDownloadProgress,
  });
  const { isDragging, handleDragOver, handleDragLeave, handleDrop } = useDragDrop({
    accept,
    disabled,
    loading,
    isDownloading,
    onFileSelect,
    setLocalError,
    setDownloadError,
  });
  // Combine errors (excluding downloadError which is shown in the URL section)
  const displayError = error || localError;
  // Render horizontal layout
  if (layout === 'horizontal' && showUrlDownload) {
    return _jsxs(Box, {
      sx: {
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        ...sx,
      },
      children: [
        _jsxs(Box, {
          sx: {
            display: 'flex',
            gap: 2,
            alignItems: 'stretch',
          },
          children: [
            _jsx(Box, {
              sx: { flex: 1 },
              children: _jsx(DragDropSection, {
                isDragging: isDragging,
                disabled: disabled,
                loading: loading,
                isDownloading: isDownloading,
                buttonLabel: buttonLabel,
                fileInputRef: fileInputRef,
                accept: accept,
                hoveredSection: hoveredSection,
                onDragOver: handleDragOver,
                onDragLeave: handleDragLeave,
                onDrop: handleDrop,
                onFileSelect: handleFileSelect,
                onMouseEnter: () => setHoveredSection('drag'),
                onMouseLeave: () => setHoveredSection(undefined),
                compact: true,
              }),
            }),
            _jsx(Box, {
              sx: { flex: 1 },
              children: _jsx(UrlDownloadSection, {
                downloadUrl: downloadUrl,
                isDownloading: isDownloading,
                disabled: disabled,
                loading: loading,
                downloadError: downloadError,
                downloadProgress: downloadProgress,
                downloadSuccess: downloadSuccess,
                isAuthError: isAuthError,
                isAuthenticated: isAuthenticated,
                isLoadingAuth: isLoadingAuth,
                hoveredSection: hoveredSection,
                onUrlChange: setDownloadUrl,
                handleDownload: handleDownload,
                onKeyPress: handleKeyPress,
                onSignIn: (provider) => {
                  devLog('FileInputWithUrl onSignIn prop:', {
                    signIn,
                    typeof: typeof signIn,
                    provider,
                  });
                  if (typeof signIn === 'function') {
                    signIn(provider);
                  } else {
                    devError('signIn is not a function in onSignIn:', signIn);
                  }
                },
                onMouseEnter: () => setHoveredSection('url'),
                onMouseLeave: () => setHoveredSection(undefined),
                compact: true,
              }),
            }),
          ],
        }),
        (loading || isDownloading) && _jsx(LoadingOverlay, { isDownloading: isDownloading }),
        displayError &&
          _jsxs(Alert, {
            severity: 'error',
            sx: { mt: 2 },
            children: [
              _jsx(Typography, { variant: 'body2', children: displayError }),
              displayError.includes('Authentication required') &&
                !isAuthenticated &&
                _jsx(Box, {
                  sx: { mt: 2 },
                  children: _jsx(Button, {
                    variant: 'contained',
                    color: 'warning',
                    size: 'small',
                    startIcon: _jsx(Login, {}),
                    onClick: () => {
                      devLog('FileInputWithUrl signIn click:', {
                        signIn,
                        typeof: typeof signIn,
                      });
                      if (typeof signIn === 'function') {
                        signIn();
                      } else {
                        devError('signIn is not a function:', signIn);
                      }
                    },
                    disabled: isLoadingAuth,
                    children: isLoadingAuth ? 'Signing in...' : 'Sign In',
                  }),
                }),
            ],
          }),
      ],
    });
  }
  // Default vertical layout
  return _jsxs(Box, {
    sx: {
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      ...sx,
    },
    children: [
      _jsx(DragDropSection, {
        isDragging: isDragging,
        disabled: disabled,
        loading: loading,
        isDownloading: isDownloading,
        buttonLabel: buttonLabel,
        fileInputRef: fileInputRef,
        accept: accept,
        hoveredSection: hoveredSection,
        onDragOver: handleDragOver,
        onDragLeave: handleDragLeave,
        onDrop: handleDrop,
        onFileSelect: handleFileSelect,
        onMouseEnter: () => setHoveredSection('drag'),
        onMouseLeave: () => setHoveredSection(undefined),
      }),
      showUrlDownload &&
        _jsxs(_Fragment, {
          children: [
            _jsx(Divider, {
              sx: { my: 3 },
              children: _jsx(Chip, {
                label: 'Alternative Method',
                size: 'small',
                color: 'default',
                sx: { px: 2 },
              }),
            }),
            _jsx(UrlDownloadSection, {
              downloadUrl: downloadUrl,
              isDownloading: isDownloading,
              disabled: disabled,
              loading: loading,
              downloadError: downloadError,
              downloadProgress: downloadProgress,
              downloadSuccess: downloadSuccess,
              isAuthError: isAuthError,
              isAuthenticated: isAuthenticated,
              isLoadingAuth: isLoadingAuth,
              hoveredSection: hoveredSection,
              onUrlChange: setDownloadUrl,
              handleDownload: handleDownload,
              onKeyPress: handleKeyPress,
              onSignIn: () => signIn(),
              onMouseEnter: () => setHoveredSection('url'),
              onMouseLeave: () => setHoveredSection(undefined),
            }),
          ],
        }),
      (loading || isDownloading) && _jsx(LoadingOverlay, { isDownloading: isDownloading }),
      displayError &&
        _jsxs(Alert, {
          severity: 'error',
          sx: { mt: 2 },
          children: [
            _jsx(Typography, { variant: 'body2', children: displayError }),
            displayError.includes('Authentication required') &&
              !isAuthenticated &&
              _jsx(Box, {
                sx: { mt: 2 },
                children: _jsx(Button, {
                  variant: 'contained',
                  color: 'warning',
                  size: 'small',
                  startIcon: _jsx(Login, {}),
                  onClick: () => signIn(),
                  disabled: isLoadingAuth,
                  children: isLoadingAuth ? 'Signing in...' : 'Sign In',
                }),
              }),
          ],
        }),
    ],
  });
};
//# sourceMappingURL=FileInputWithUrl.js.map
