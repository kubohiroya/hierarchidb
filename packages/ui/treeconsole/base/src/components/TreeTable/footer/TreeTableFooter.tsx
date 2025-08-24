import { memo } from 'react';
import { Box, Typography, LinearProgress, Chip, IconButton, Tooltip, Button } from '@mui/material';
import {
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

export interface TreeTableFooterProps {
  readonly totalItems: number;
  readonly selectedItems: number;
  readonly visibleItems: number;
  readonly isLoading?: boolean;
  readonly loadingProgress?: number;
  readonly loadingMessage?: string;
  readonly error?: string;
  readonly warning?: string;
  readonly info?: string;
  readonly success?: string;
  readonly onRetry?: () => void;
  readonly onClearMessages?: () => void;
  readonly showDetails?: boolean;
  readonly onToggleDetails?: () => void;
}

export const TreeTableFooter = memo(function TreeTableFooter(props: TreeTableFooterProps) {
  const {
    totalItems,
    selectedItems,
    visibleItems,
    isLoading = false,
    loadingProgress,
    loadingMessage,
    error,
    warning,
    info,
    success,
    onRetry,
    onClearMessages,
    showDetails = false,
    onToggleDetails,
  } = props;

  const hasMessages = Boolean(error || warning || info || success);

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        borderTop: '1px solid',
        borderTopColor: 'divider',
        minHeight: 40,
      }}
    >
      {/* Loading Progress */}
      {isLoading && (
        <Box sx={{ px: 2, py: 0.5 }}>
          <LinearProgress
            variant={loadingProgress !== undefined ? 'determinate' : 'indeterminate'}
            value={loadingProgress}
            sx={{ mb: 1 }}
          />
          {loadingMessage && (
            <Typography variant="caption" color="text.secondary">
              {loadingMessage}
            </Typography>
          )}
        </Box>
      )}

      {/* Main Footer Content */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1,
          minHeight: 40,
        }}
      >
        {/* Left Side - Item Statistics */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {selectedItems > 0 ? (
              <>
                <strong>{selectedItems}</strong> of <strong>{visibleItems}</strong> selected
                {visibleItems !== totalItems && <> (filtered from {totalItems} total)</>}
              </>
            ) : (
              <>
                Showing <strong>{visibleItems}</strong>
                {visibleItems !== totalItems && <> of {totalItems}</>} items
              </>
            )}
          </Typography>

          {/* Status Chips */}
          {visibleItems !== totalItems && (
            <Chip size="small" label="Filtered" variant="outlined" color="primary" />
          )}
        </Box>

        {/* Right Side - Messages and Actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Message Indicators */}
          {hasMessages && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {error && (
                <Tooltip title={error}>
                  <IconButton size="small" color="error">
                    <ErrorIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}

              {warning && (
                <Tooltip title={warning}>
                  <IconButton size="small" color="warning">
                    <WarningIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}

              {info && (
                <Tooltip title={info}>
                  <IconButton size="small" color="info">
                    <InfoIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}

              {success && (
                <Tooltip title={success}>
                  <IconButton size="small" color="success">
                    <CheckCircleIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}

              {/* Retry Button */}
              {error && onRetry && (
                <Tooltip title="Retry">
                  <IconButton size="small" onClick={onRetry}>
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}

              {/* Clear Messages Button */}
              {onClearMessages && (
                <Button
                  size="small"
                  variant="text"
                  onClick={onClearMessages}
                  sx={{ minWidth: 'auto', px: 1 }}
                >
                  Clear
                </Button>
              )}
            </Box>
          )}

          {/* Details Toggle */}
          {onToggleDetails && (
            <Button
              size="small"
              variant="text"
              onClick={onToggleDetails}
              sx={{ minWidth: 'auto', px: 1 }}
            >
              {showDetails ? 'Hide' : 'Show'} Details
            </Button>
          )}
        </Box>
      </Box>

      {/* Detailed Messages Panel */}
      {showDetails && hasMessages && (
        <Box
          sx={{
            px: 2,
            py: 1,
            bgcolor: 'action.hover',
            borderTop: '1px solid',
            borderTopColor: 'divider',
          }}
        >
          {error && (
            <Typography variant="body2" color="error" sx={{ mb: 0.5 }}>
              <ErrorIcon fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />
              {error}
            </Typography>
          )}

          {warning && (
            <Typography variant="body2" color="warning.main" sx={{ mb: 0.5 }}>
              <WarningIcon fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />
              {warning}
            </Typography>
          )}

          {info && (
            <Typography variant="body2" color="info.main" sx={{ mb: 0.5 }}>
              <InfoIcon fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />
              {info}
            </Typography>
          )}

          {success && (
            <Typography variant="body2" color="success.main" sx={{ mb: 0.5 }}>
              <CheckCircleIcon fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />
              {success}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
});
