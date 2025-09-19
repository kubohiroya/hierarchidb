/**
  * @file ErrorDisplay.tsx
 * @description UI
  * UI
 * 1.
 * 2.
 * 3.
 * 4.
  */

import * as React from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import {
  Cancel as CancelIcon,
  CheckCircle as CheckCircleIcon,
  CloudOff as CloudOffIcon,
  Error as ErrorIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
  Report as ReportIcon,
  Settings as SettingsIcon,
  Speed as SpeedIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';

import type { ActionType, BaseShapeError, ErrorSeverity, SuggestedAction } from '../../types/ShapeErrorHierarchy.js';
import type { RecoveryResult } from '../../services/RecoveryStrategy.js';

// ========================================
//  Props
// ========================================

export interface ErrorDisplayProps {
  error: BaseShapeError;
  onAction: (action: SuggestedAction) => Promise<void>;
  onDismiss?: () => void;
  showTechnicalDetails?: boolean;
  autoRecoveryEnabled?: boolean;
}

export interface ErrorRecoveryDialogProps {
  open: boolean;
  error: BaseShapeError;
  recoveryResult?: RecoveryResult;
  onRetry: () => void;
  onCancel: () => void;
  onAdjustSettings?: () => void;
}

// ========================================
// ========================================

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
                                                            error,
                                                            onAction,
                                                            onDismiss,
                                                            showTechnicalDetails = false,
                                                            autoRecoveryEnabled = false,
                                                          }) => {
  const [expanded, setExpanded] = React.useState(false);
  const [actionInProgress, setActionInProgress] = React.useState<string | null>(null);
  const [autoRecoveryProgress, setAutoRecoveryProgress] = React.useState(0);

  const getSeverityStyle = (severity: ErrorSeverity) => {
    switch (severity) {
      case 'CRITICAL':
        return { color: 'error', icon: React.createElement(ErrorIcon) };
      case 'ERROR':
        return { color: 'error', icon: React.createElement(ErrorIcon) };
      case 'WARNING':
        return { color: 'warning', icon: React.createElement(WarningIcon) };
      case 'INFO':
        return { color: 'info', icon: React.createElement(InfoIcon) };
      default:
        return { color: 'info', icon: React.createElement(InfoIcon) };
    }
  };

  const style = getSeverityStyle(error.severity);

  const handleAction = async (action: SuggestedAction) => {
    setActionInProgress(action.type);
    try {
      await onAction(action);
    } finally {
      setActionInProgress(null);
    }
  };

  const getActionIcon = (actionType: ActionType) => {
    switch (actionType) {
      case 'RETRY':
      case 'RETRY_WITH_BACKOFF':
        return React.createElement(RefreshIcon);
      case 'REDUCE_CONCURRENCY':
      case 'REDUCE_DATA_SIZE':
        return React.createElement(SpeedIcon);
      case 'CHANGE_CONFIGURATION':
        return React.createElement(SettingsIcon);
      case 'CHECK_CONNECTION':
        return React.createElement(CloudOffIcon);
      case 'REPORT_ISSUE':
        return React.createElement(ReportIcon);
      case 'CANCEL':
        return React.createElement(CancelIcon);
      default:
        return React.createElement(CheckCircleIcon);
    }
  };

  React.useEffect(() => {
    if (autoRecoveryEnabled && error.retryable) {
      const interval = setInterval(() => {
        setAutoRecoveryProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            const retryAction = error.suggestedActions?.find(
              a => a.type === 'RETRY' || a.type === 'RETRY_WITH_BACKOFF',
            );
            if (retryAction) {
              handleAction(retryAction);
            }
            return 0;
          }
          return prev + 10;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [autoRecoveryEnabled, error]);

  return React.createElement(Alert, {
      severity: style.color as any,
      icon: style.icon,
      onClose: onDismiss,
      sx: { mb: 2 },
    },
    React.createElement(AlertTitle, null,
      error.userMessage || error.message,
    ),

    React.createElement(Box, null,
      React.createElement(Stack, {
          direction: 'row',
          spacing: 1,
          sx: { mb: 1 },
        },
        React.createElement(Chip, {
          label: error.category,
          size: 'small',
          variant: 'outlined',
        }),
        React.createElement(Chip, {
          label: error.code,
          size: 'small',
          variant: 'outlined',
        }),
        error.stage && React.createElement(Chip, {
          label: `Stage: ${error.stage}`,
          size: 'small',
          color: 'primary',
          variant: 'outlined',
        }),
      ),

      autoRecoveryEnabled && error.retryable && autoRecoveryProgress > 0 &&
      React.createElement(Box, { sx: { mb: 2 } },
        React.createElement(Typography, {
          variant: 'caption',
          color: 'text.secondary',
        }, '自動リカバリを実行中...'),
        React.createElement(LinearProgress, {
          variant: 'determinate',
          value: autoRecoveryProgress,
          sx: { mt: 1 },
        }),
      ),

      error.suggestedActions && error.suggestedActions.length > 0 &&
      React.createElement(Stack, {
          direction: 'row',
          spacing: 1,
          sx: { mt: 2 },
        },
        ...error.suggestedActions.map((action) =>
          React.createElement(Button, {
              key: action.type,
              variant: action.type === 'RETRY' ? 'contained' : 'outlined',
              size: 'small',
              startIcon: getActionIcon(action.type),
              onClick: () => handleAction(action),
              disabled: actionInProgress !== null,
              sx: { textTransform: 'none' },
            },
            actionInProgress === action.type ? '実行中...' : action.label,
          ),
        ),
      ),

      //  /
      (showTechnicalDetails || error.technicalDetails) &&
      React.createElement(Box, { sx: { mt: 2 } },
        React.createElement(Button, {
          size: 'small',
          onClick: () => setExpanded(!expanded),
          endIcon: expanded ?
            React.createElement(ExpandLessIcon) :
            React.createElement(ExpandMoreIcon),
        }, '技術詳細'),

        React.createElement(Collapse, { in: expanded },
          React.createElement(Box, {
              sx: {
                mt: 1,
                p: 2,
                bgcolor: 'background.paper',
                borderRadius: 1,
                fontSize: '0.875rem',
                fontFamily: 'monospace',
              },
            },
            React.createElement(Typography, {
                variant: 'caption',
                component: 'pre',
                sx: { whiteSpace: 'pre-wrap' },
              },
              JSON.stringify({
                type: error.type,
                code: error.code,
                timestamp: new Date(error.timestamp).toISOString(),
                sessionId: error.sessionId,
                technicalDetails: error.technicalDetails,
                stack: error.stack,
              }, null, 2),
            ),
          ),
        ),
      ),
    ),
  );
};

// ========================================
// ========================================

export const ErrorRecoveryDialog: React.FC<ErrorRecoveryDialogProps> = ({
                                                                          open,
                                                                          error,
                                                                          recoveryResult,
                                                                          onRetry,
                                                                          onCancel,
                                                                          onAdjustSettings,
                                                                        }) => {
  const getRecoveryOptions = () => {
    const options = [];

    if (error.retryable) {
      options.push({
        icon: React.createElement(RefreshIcon),
        label: '再試行',
        description: 'もう一度同じ処理を実行します',
        action: onRetry,
        primary: true,
      });
    }

    if (onAdjustSettings && error.suggestedActions?.some(a =>
      a.type === 'CHANGE_CONFIGURATION' ||
      a.type === 'REDUCE_CONCURRENCY',
    )) {
      options.push({
        icon: React.createElement(SettingsIcon),
        label: '設定を調整',
        description: 'パラメータを変更してから再試行',
        action: onAdjustSettings,
        primary: false,
      });
    }

    options.push({
      icon: React.createElement(CancelIcon),
      label: 'キャンセル',
      description: '処理を中断します',
      action: onCancel,
      primary: false,
    });

    return options;
  };

  return React.createElement(Dialog, {
      open,
      onClose: onCancel,
      maxWidth: 'sm',
      fullWidth: true,
    },
    React.createElement(DialogTitle, null,
      'エラーが発生しました',
    ),

    React.createElement(DialogContent, null,
      React.createElement(Alert, {
          severity: 'error',
          sx: { mb: 2 },
        },
        error.userMessage || error.message,
      ),

      recoveryResult && React.createElement(Alert, {
          severity: recoveryResult.success ? 'success' : 'warning',
          sx: { mb: 2 },
        },
        React.createElement(AlertTitle, null,
          'リカバリ戦略: ', recoveryResult.strategy,
        ),
        recoveryResult.message,
      ),

      React.createElement(Divider, { sx: { my: 2 } }),

      React.createElement(Typography, {
        variant: 'subtitle2',
        gutterBottom: true,
      }, '次のアクションを選択してください:'),

      React.createElement(List, null,
        ...getRecoveryOptions().map((option, index) =>
          React.createElement(React.Fragment, { key: index },
            React.createElement(ListItem, {
                button: true,
                onClick: option.action,
                sx: option.primary ? {
                  bgcolor: 'action.hover',
                } : {},
              },
              React.createElement(ListItemIcon, null, option.icon),
              React.createElement(ListItemText, {
                primary: option.label,
                secondary: option.description,
              }),
            ),
            index < getRecoveryOptions().length - 1 &&
            React.createElement(Divider, { variant: 'inset', component: 'li' }),
          ),
        ),
      ),
    ),

    React.createElement(DialogActions, null,
      React.createElement(Button, {
        onClick: onCancel,
        color: 'inherit',
      }, 'キャンセル'),

      error.retryable && React.createElement(Button, {
        onClick: onRetry,
        variant: 'contained',
        startIcon: React.createElement(RefreshIcon),
      }, '再試行'),
    ),
  );
};

// ========================================
//  Snackbar
// ========================================

export interface ErrorToastProps {
  errors: BaseShapeError[];
  onClose: (error: BaseShapeError) => void;
  position?: {
    vertical: 'top' | 'bottom';
    horizontal: 'left' | 'center' | 'right';
  };
}

export const ErrorToast: React.FC<ErrorToastProps> = ({
                                                        errors,
                                                        onClose,
                                                        position = { vertical: 'bottom', horizontal: 'right' },
                                                      }) => {
  return React.createElement(Stack, {
      spacing: 1,
      sx: {
        position: 'fixed',
        [position.vertical]: 16,
        [position.horizontal]: 16,
        zIndex: 9999,
        maxWidth: 400,
      },
    },
    ...errors.map((error) =>
      React.createElement(Alert, {
          key: `${error.code}-${error.timestamp}`,
          severity: error.severity === 'CRITICAL' || error.severity === 'ERROR' ?
            'error' : error.severity.toLowerCase() as any,
          onClose: () => onClose(error),
          sx: {
            boxShadow: 3,
            '& .MuiAlert-message': {
              width: '100%',
            },
          },
        },
        React.createElement(Box, null,
          React.createElement(Typography, {
              variant: 'body2',
              sx: { fontWeight: 500 },
            },
            error.userMessage || error.message,
          ),

          error.suggestedActions && error.suggestedActions.length > 0 &&
          React.createElement(Box, { sx: { mt: 1 } },
            React.createElement(Button, {
                size: 'small',
                variant: 'text',
                onClick: () => {
                  const firstAction = error.suggestedActions![0];
                },
                sx: { p: 0, minWidth: 0 },
              },
              error.suggestedActions[0].label,
            ),
          ),
        ),
      ),
    ),
  );
};