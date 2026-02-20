import { Login } from '@mui/icons-material';
import { Alert, Box, Button, Chip, Divider, Typography } from '@mui/material';
import type React from 'react';
import { useState } from 'react';
import { devError, devLog } from '~/utils/logger';
import { DragDropSection } from './DragDropSection.js';
import { useDragDrop, useFileInput, useUrlDownload } from './hooks/index.js';
import { LoadingOverlay } from './LoadingOverlay.js';
import { UrlDownloadSection } from './UrlDownloadSection.js';

export interface FileInputWithUrlProps {
  /**
   * Callback when a file is selected or downloaded
   */
  onFileSelect: (file: File, downloadUrl?: string) => void | Promise<void>;

  /**
   * Accepted file types (e.g., ".csv,.xlsx,.zip")
   */
  accept?: string;

  /**
   * Display label for the file selection button
   */
  buttonLabel?: string;

  /**
   * Whether the component is in a loading atoms
   */
  loading?: boolean;

  /**
   * Error message to display
   */
  error?: string | null;

  /**
   * Whether to show the URL download option
   */
  showUrlDownload?: boolean;

  /**
   * Custom instructions to display
   */
  instructions?: React.ReactNode;

  /**
   * Whether the component is disabled
   */
  disabled?: boolean;

  /**
   * Additional styles for the root container
   */
  sx?: object;

  /**
   * Optional custom URL download handler (if not provided, built-in handler will be used)
   */
  onUrlDownload?: (url: string) => Promise<void>;

  /**
   * Default URL to populate the download field
   */
  defaultDownloadUrl?: string;

  /**
   * Callback for download progress updates
   */
  onDownloadProgress?: (progress: number | undefined) => void;

  /**
   * Layout orientation - horizontal layout with compact styling
   */
  layout?: 'vertical' | 'horizontal';

  /**
   * Display mode for local vs. URL inputs
   */
  mode?: 'local' | 'url' | 'both';
}

export const FileInputWithUrl: React.FC<FileInputWithUrlProps> = ({
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
  mode,
}) => {
  const [hoveredSection, setHoveredSection] = useState<'drag' | 'url' | undefined>();
  const resolvedMode =
    mode ?? (showUrlDownload ? 'both' : 'local');
  const showLocalUpload = resolvedMode !== 'url';
  const showUrlDownloadSection = resolvedMode !== 'local';

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
  if (layout === 'horizontal' && showLocalUpload && showUrlDownloadSection) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          ...sx,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            alignItems: 'stretch',
          }}
        >
          {/* Left side - Local file selection */}
          <Box sx={{ flex: 1 }}>
            <DragDropSection
              isDragging={isDragging}
              disabled={disabled}
              loading={loading}
              isDownloading={isDownloading}
              buttonLabel={buttonLabel}
              fileInputRef={fileInputRef as React.RefObject<HTMLInputElement>}
              accept={accept}
              hoveredSection={hoveredSection}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onFileSelect={handleFileSelect}
              onMouseEnter={() => setHoveredSection('drag')}
              onMouseLeave={() => setHoveredSection(undefined)}
              compact={true}
            />
          </Box>

          {/* Right side - URL download */}
          <Box sx={{ flex: 1 }}>
            <UrlDownloadSection
              downloadUrl={downloadUrl}
              isDownloading={isDownloading}
              disabled={disabled}
              loading={loading}
              downloadError={downloadError}
              downloadProgress={downloadProgress}
              downloadSuccess={downloadSuccess}
              isAuthError={isAuthError}
              isAuthenticated={isAuthenticated}
              isLoadingAuth={isLoadingAuth}
              hoveredSection={hoveredSection}
              onUrlChange={setDownloadUrl}
              handleDownload={handleDownload}
              onKeyPress={handleKeyPress}
              onSignIn={(provider) => {
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
              }}
              onMouseEnter={() => setHoveredSection('url')}
              onMouseLeave={() => setHoveredSection(undefined)}
              compact={true}
            />
          </Box>
        </Box>

        {/* Loading indicator overlay */}
        {(loading || isDownloading) && <LoadingOverlay isDownloading={isDownloading} />}

        {/* Error display */}
        {displayError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            <Typography variant="body2">{displayError}</Typography>
            {/* Show login button for authentication errors */}
            {displayError.includes('Authentication required') && !isAuthenticated && (
              <Box sx={{ mt: 2 }}>
                <Button
                  variant="contained"
                  color="warning"
                  size="small"
                  startIcon={<Login />}
                  onClick={() => {
                    devLog('FileInputWithUrl signIn click:', {
                      signIn,
                      typeof: typeof signIn,
                    });
                    if (typeof signIn === 'function') {
                      signIn();
                    } else {
                      devError('signIn is not a function:', signIn);
                    }
                  }}
                  disabled={isLoadingAuth}
                >
                  {isLoadingAuth ? 'Signing in...' : 'Sign In'}
                </Button>
              </Box>
            )}
          </Alert>
        )}
      </Box>
    );
  }

  // Default vertical layout
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        ...sx,
      }}
    >
      {showLocalUpload ? (
        <DragDropSection
          isDragging={isDragging}
          disabled={disabled}
          loading={loading}
          isDownloading={isDownloading}
          buttonLabel={buttonLabel}
          fileInputRef={fileInputRef as React.RefObject<HTMLInputElement>}
          accept={accept}
          hoveredSection={hoveredSection}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onFileSelect={handleFileSelect}
          onMouseEnter={() => setHoveredSection('drag')}
          onMouseLeave={() => setHoveredSection(undefined)}
        />
      ) : null}

      {/* URL download section */}
      {showUrlDownloadSection && (
        <>
          {showLocalUpload ? (
            <Divider sx={{ my: 3 }}>
              <Chip label="Alternative Method" size="small" color="default" sx={{ px: 2 }} />
            </Divider>
          ) : null}

          <UrlDownloadSection
            downloadUrl={downloadUrl}
            isDownloading={isDownloading}
            disabled={disabled}
            loading={loading}
            downloadError={downloadError}
            downloadProgress={downloadProgress}
            downloadSuccess={downloadSuccess}
            isAuthError={isAuthError}
            isAuthenticated={isAuthenticated}
            isLoadingAuth={isLoadingAuth}
            hoveredSection={hoveredSection}
            onUrlChange={setDownloadUrl}
            handleDownload={handleDownload}
            onKeyPress={handleKeyPress}
            onSignIn={() => signIn()}
            onMouseEnter={() => setHoveredSection('url')}
            onMouseLeave={() => setHoveredSection(undefined)}
          />
        </>
      )}

      {/* Loading indicator overlay */}
      {(loading || isDownloading) && <LoadingOverlay isDownloading={isDownloading} />}

      {/* Error display */}
      {displayError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          <Typography variant="body2">{displayError}</Typography>
          {/* Show login button for authentication errors */}
          {displayError.includes('Authentication required') && !isAuthenticated && (
            <Box sx={{ mt: 2 }}>
              <Button
                variant="contained"
                color="warning"
                size="small"
                startIcon={<Login />}
                onClick={() => signIn()}
                disabled={isLoadingAuth}
              >
                {isLoadingAuth ? 'Signing in...' : 'Sign In'}
              </Button>
            </Box>
          )}
        </Alert>
      )}
    </Box>
  );
};
