import React, { useState } from 'react';
import { Alert, Box, Button, Chip, Divider, Typography } from '@mui/material';
import { Login } from '@mui/icons-material';
import { DragDropSection } from '@/shared/components/ui/FileInputWithUrl/DragDropSection';
import { UrlDownloadSection } from '@/shared/components/ui/FileInputWithUrl/UrlDownloadSection';
import { LoadingOverlay } from '@/shared/components/ui/FileInputWithUrl/LoadingOverlay';
import {
  useDragDrop,
  useFileInput,
  useUrlDownload,
} from '@/shared/components/ui/FileInputWithUrl/hooks';
// import { devLog, devError } from "@/shared/utils/logger";

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
   * Whether the component is in a loading state
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
}) => {
  const [hoveredSection, setHoveredSection] = useState<'drag' | 'url' | undefined>();

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
                // Debug log removed
                if (typeof signIn === 'function') {
                  signIn(provider);
                } else {
                  console.error('signIn is not a function in onSignIn:', signIn);
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
                    // Debug log removed
                    if (typeof signIn === 'function') {
                      signIn();
                    } else {
                      console.error('signIn is not a function:', signIn);
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

      {/* URL download section */}
      {showUrlDownload && (
        <>
          <Divider sx={{ my: 3 }}>
            <Chip label="Alternative Method" size="small" color="default" sx={{ px: 2 }} />
          </Divider>

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
