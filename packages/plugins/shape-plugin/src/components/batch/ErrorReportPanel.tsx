/**
 * @file ErrorReportPanel.tsx
 * @description Simple error report panel with chronological error log
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { Alert, AlertTitle, Box, Chip, Divider, IconButton, Paper, Stack, Typography } from '@mui/material';
import {
  BugReport as CriticalIcon,
  Clear as ClearIcon,
  ErrorOutline as ErrorIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';

export interface ErrorLogEntry {
  id: string;
  timestamp: number;
  level: 'critical' | 'error' | 'warning' | 'info';
  phase: string;
  message: string;
  details?: string;
  rowNumber?: number;
  columnName?: string;
}

export interface ErrorReportPanelProps {
  errors: ErrorLogEntry[];
  onClearErrors: () => void;
  batchStatus: string;
  taskCounts: {
    download: number;
    simplify1: number;
    simplify2: number;
    vectorTile: number;
  };
}

const ERROR_LEVEL_CONFIG = {
  critical: {
    icon: CriticalIcon,
    color: '#d32f2f' as const,
    bgcolor: '#ffebee' as const,
    label: 'CRITICAL',
  },
  error: {
    icon: ErrorIcon,
    color: '#f57c00' as const,
    bgcolor: '#fff3e0' as const,
    label: 'ERROR',
  },
  warning: {
    icon: WarningIcon,
    color: '#ed6c02' as const,
    bgcolor: '#fff8e1' as const,
    label: 'WARNING',
  },
  info: {
    icon: InfoIcon,
    color: '#0288d1' as const,
    bgcolor: '#e3f2fd' as const,
    label: 'INFO',
  },
};

export const ErrorReportPanel: React.FC<ErrorReportPanelProps> = ({
                                                                    errors,
                                                                    onClearErrors,
                                                                    batchStatus,
                                                                    taskCounts,
                                                                  }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new errors are added
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [errors]);

  // Error statistics
  const errorStats = useMemo(() => {
    const stats = {
      critical: 0,
      error: 0,
      warning: 0,
      info: 0,
      total: errors.length,
    };

    errors.forEach(error => {
      stats[error.level]++;
    });

    return stats;
  }, [errors]);

  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString('ja-JP', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatRowInfo = (rowNumber?: number, columnName?: string): string => {
    if (rowNumber && columnName) {
      return `row ${rowNumber}, column '${columnName}'`;
    }
    if (rowNumber) {
      return `row ${rowNumber}`;
    }
    if (columnName) {
      return `column '${columnName}'`;
    }
    return '';
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 2 }}>
      {/* Header */}
      <Box sx={{ mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Typography variant="h6">
            Error Report
          </Typography>
          <IconButton
            onClick={onClearErrors}
            disabled={errors.length === 0}
            size="small"
            title="Clear all errors"
          >
            <ClearIcon />
          </IconButton>
        </Stack>

        {/* Status Summary */}
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          <Chip
            size="small"
            label={`Status: ${batchStatus}`}
            color={batchStatus === 'error' ? 'error' : 'default'}
          />
          <Chip
            size="small"
            label={`Total Tasks: ${Object.values(taskCounts).reduce((a, b) => a + b, 0)}`}
            variant="outlined"
          />
        </Stack>
      </Box>

      {/* Error Statistics */}
      {errorStats.total > 0 && (
        <Box sx={{ mb: 2 }}>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {(Object.keys(ERROR_LEVEL_CONFIG) as Array<keyof typeof ERROR_LEVEL_CONFIG>).map((level) => {
              const count = errorStats[level];
              if (count === 0) return null;

              const config = ERROR_LEVEL_CONFIG[level];
              return (
                <Chip
                  key={level}
                  size="small"
                  label={`${config.label}: ${count}`}
                  sx={{
                    color: config.color,
                    bgcolor: config.bgcolor,
                    fontWeight: 'bold',
                  }}
                />
              );
            })}
          </Stack>
        </Box>
      )}

      <Divider sx={{ mb: 2 }} />

      {/* Error Log */}
      <Box sx={{ flex: 1, minHeight: 0 }}>
        {errors.length === 0 ? (
          <Alert severity="success">
            <AlertTitle>No Errors</AlertTitle>
            All batch processing tasks are running without errors.
          </Alert>
        ) : (
          <Paper
            ref={scrollRef}
            variant="outlined"
            sx={{
              height: '100%',
              overflow: 'auto',
              p: 1,
              bgcolor: '#fafafa',
              fontFamily: 'monospace',
              fontSize: '0.875rem',
            }}
          >
            <Stack spacing={0.5}>
              {errors.map((error) => {
                const config = ERROR_LEVEL_CONFIG[error.level];
                const Icon = config.icon;
                const rowInfo = formatRowInfo(error.rowNumber, error.columnName);

                return (
                  <Box
                    key={error.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 1,
                      p: 1,
                      borderRadius: 1,
                      bgcolor: 'white',
                      border: `1px solid ${config.color}20`,
                      '&:hover': {
                        bgcolor: config.bgcolor,
                      },
                    }}
                  >
                    {/* Timestamp */}
                    <Typography
                      variant="caption"
                      sx={{
                        minWidth: '70px',
                        color: 'text.secondary',
                        fontFamily: 'monospace',
                        fontSize: '0.75rem',
                      }}
                    >
                      {formatTimestamp(error.timestamp)}
                    </Typography>

                    {/* Level Icon and Label */}
                    <Box sx={{ display: 'flex', alignItems: 'center', minWidth: '80px' }}>
                      <Icon sx={{ fontSize: 14, color: config.color, mr: 0.5 }} />
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 'bold',
                          color: config.color,
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                        }}
                      >
                        {config.label}
                      </Typography>
                    </Box>

                    {/* Message */}
                    <Box sx={{ flex: 1 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: 'monospace',
                          fontSize: '0.8rem',
                          wordBreak: 'break-word',
                        }}
                      >
                        {error.phase && (
                          <span style={{ color: '#666', marginRight: 8 }}>
                            [{error.phase}]
                          </span>
                        )}
                        {error.message}
                        {rowInfo && (
                          <span style={{ color: '#888', marginLeft: 8 }}>
                            ({rowInfo})
                          </span>
                        )}
                      </Typography>
                      {error.details && (
                        <Typography
                          variant="caption"
                          sx={{
                            display: 'block',
                            color: 'text.secondary',
                            fontFamily: 'monospace',
                            fontSize: '0.7rem',
                            mt: 0.5,
                            fontStyle: 'italic',
                          }}
                        >
                          {error.details}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          </Paper>
        )}
      </Box>
    </Box>
  );
};