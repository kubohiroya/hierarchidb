/**
 * Batch Recovery Dialog Component
 * Displays pending batch sessions that can be resumed from direct link access
 */

import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Card,
  CardContent,
  Typography,
  Box,
  LinearProgress,
  Chip,
  Alert
} from '@mui/material';
import {
  PlayArrow as PlayArrowIcon,
  Delete as DeleteIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { BatchSession, formatDuration } from '../../shared';

export interface BatchRecoveryDialogProps {
  open: boolean;
  sessions: BatchSession[];
  onResume: (session: BatchSession) => void;
  onDiscard: (sessionId: string) => void;
  onClose: () => void;
  loading?: boolean;
}

export function BatchRecoveryDialog({
  open,
  sessions,
  onResume,
  onDiscard,
  onClose,
  loading = false
}: BatchRecoveryDialogProps) {
  const [processingSessionId, setProcessingSessionId] = useState<string | null>(null);

  const handleResume = useCallback((session: BatchSession) => {
    setProcessingSessionId(session.sessionId);
    onResume(session);
  }, [onResume]);

  const handleDiscard = useCallback((sessionId: string) => {
    setProcessingSessionId(sessionId);
    onDiscard(sessionId);
  }, [onDiscard]);

  const getTimeRemaining = (expiresAt: number): string => {
    const remaining = expiresAt - Date.now();
    return remaining > 0 ? formatDuration(remaining) : 'Expired';
  };

  const getStatusColor = (status: BatchSession['status']) => {
    switch (status) {
      case 'paused': return 'warning';
      case 'failed': return 'error';
      case 'completed': return 'success';
      default: return 'default';
    }
  };

  if (!open || sessions.length === 0) {
    return null;
  }

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md" 
      fullWidth
      disableEscapeKeyDown={loading}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <ScheduleIcon color="warning" />
          中断されたバッチ処理が見つかりました
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          以下のバッチ処理が中断された状態で残っています。続行するか削除を選択してください。
          データは24時間後に自動削除されます。
        </Alert>
        
        <Box display="flex" flexDirection="column" gap={2}>
          {sessions.map((session) => {
            const isExpired = session.expiresAt <= Date.now();
            const isProcessing = processingSessionId === session.sessionId;
            
            return (
              <Card 
                key={session.sessionId}
                variant="outlined"
                sx={{ 
                  opacity: isExpired ? 0.6 : 1,
                  border: isExpired ? '1px solid #f44336' : undefined
                }}
              >
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        バッチ処理セッション
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        セッションID: {session.sessionId}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        開始時刻: {new Date(session.startedAt).toLocaleString()}
                      </Typography>
                    </Box>
                    
                    <Box display="flex" flexDirection="column" alignItems="flex-end" gap={1}>
                      <Chip 
                        label={session.status}
                        color={getStatusColor(session.status)}
                        size="small"
                      />
                      <Typography variant="caption" color="text.secondary">
                        残り: {getTimeRemaining(session.expiresAt)}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Progress Information */}
                  <Box mb={2}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                      <Typography variant="body2">
                        進捗: {session.progress.currentStage || 'Unknown'}
                      </Typography>
                      <Typography variant="body2">
                        {session.progress.percentage.toFixed(1)}%
                      </Typography>
                    </Box>
                    
                    <LinearProgress 
                      variant="determinate" 
                      value={session.progress.percentage}
                      sx={{ mb: 1 }}
                    />
                    
                    <Typography variant="caption" color="text.secondary">
                      完了: {session.progress.completed} / 総数: {session.progress.total}
                      {session.progress.failed > 0 && `, 失敗: ${session.progress.failed}`}
                    </Typography>
                  </Box>

                  {/* Current Task */}
                  {session.progress.currentTask && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      現在のタスク: {session.progress.currentTask}
                    </Typography>
                  )}

                  {/* Action Buttons */}
                  <Box display="flex" gap={1} justifyContent="flex-end">
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      startIcon={<DeleteIcon />}
                      onClick={() => handleDiscard(session.sessionId)}
                      disabled={loading || isProcessing || isExpired}
                    >
                      削除
                    </Button>
                    
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<PlayArrowIcon />}
                      onClick={() => handleResume(session)}
                      disabled={loading || isProcessing || isExpired || !session.canResume}
                    >
                      続行
                    </Button>
                  </Box>
                  
                  {isExpired && (
                    <Alert severity="error" sx={{ mt: 2 }}>
                      このセッションは有効期限が切れています
                    </Alert>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button 
          onClick={onClose} 
          disabled={loading}
          variant="outlined"
        >
          後で決める
        </Button>
        
        <Button
          onClick={() => {
            // Discard all sessions
            sessions.forEach(session => handleDiscard(session.sessionId));
          }}
          disabled={loading || sessions.every(s => s.expiresAt <= Date.now())}
          color="error"
        >
          すべて削除
        </Button>
      </DialogActions>
    </Dialog>
  );
}