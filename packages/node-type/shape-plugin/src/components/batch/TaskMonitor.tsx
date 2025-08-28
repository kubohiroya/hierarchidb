import React from 'react';
import {
  Card,
  CardContent,
  Stack,
  Typography,
  LinearProgress,
  IconButton,
  Alert,
  Chip,
} from '@mui/material';
import {
  PlayArrow as PlayArrowIcon,
  Pause as PauseIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Cancel as CancelIcon,
  HourglassEmpty as WaitIcon,
} from '@mui/icons-material';
import type { BatchTask, BatchTaskStage } from '~/types';

interface TaskMonitorProps {
  tasks: BatchTask[];
  onCancelTask: (taskId: string) => void;
  onResumeTask: (taskId: string) => void;
}

export const TaskMonitor: React.FC<TaskMonitorProps> = ({
  tasks,
  onCancelTask,
  onResumeTask,
}) => {
  const getTaskTitle = (task: BatchTask): string => {
    if ('countryCode' in task && 'adminLevel' in task) {
      return `${task.countryCode} - Level ${task.adminLevel}`;
    }
    if ('url' in task && typeof task.url === 'string') {
      return task.url.split('/').pop() || 'Unknown file';
    }
    return `Task ${task.taskId}`;
  };

  const getStageIcon = (stage: BatchTaskStage) => {
    switch (stage) {
      case 'wait':
        return <WaitIcon fontSize="small" color="disabled" />;
      case 'process':
        return null; // Show progress bar instead
      case 'success':
        return <CheckCircleIcon fontSize="small" color="success" />;
      case 'error':
        return <ErrorIcon fontSize="small" color="error" />;
      case 'pause':
        return <PauseIcon fontSize="small" color="warning" />;
      case 'cancel':
        return <CancelIcon fontSize="small" color="action" />;
      default:
        return null;
    }
  };

  const getStageChip = (stage: BatchTaskStage) => {
    const configs = {
      wait: { label: 'Waiting', color: 'default' as const },
      process: { label: 'Processing', color: 'primary' as const },
      success: { label: 'Complete', color: 'success' as const },
      error: { label: 'Error', color: 'error' as const },
      pause: { label: 'Paused', color: 'warning' as const },
      cancel: { label: 'Cancelled', color: 'default' as const },
    };
    
    const config = configs[stage] || { label: stage, color: 'default' as const };
    return <Chip label={config.label} size="small" color={config.color} />;
  };

  if (tasks.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
        No tasks in this stage
      </Typography>
    );
  }

  return (
    <Stack spacing={1}>
      {tasks.map((task) => (
        <Card key={task.taskId} variant="outlined">
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1 }}>
                {getStageIcon(task.stage)}
                <Typography variant="body2" sx={{ flex: 1 }}>
                  {getTaskTitle(task)}
                </Typography>
              </Stack>
              
              <Stack direction="row" spacing={1} alignItems="center">
                {getStageChip(task.stage)}
                
                {task.stage === 'process' && (
                  <IconButton 
                    size="small" 
                    onClick={() => onCancelTask(task.taskId)}
                    title="Pause task"
                  >
                    <PauseIcon fontSize="small" />
                  </IconButton>
                )}
                
                {task.stage === 'pause' && (
                  <IconButton 
                    size="small" 
                    onClick={() => onResumeTask(task.taskId)}
                    title="Resume task"
                  >
                    <PlayArrowIcon fontSize="small" />
                  </IconButton>
                )}
              </Stack>
            </Stack>
            
            {task.stage === 'process' && task.progress !== undefined && (
              <LinearProgress 
                variant="determinate" 
                value={task.progress} 
                sx={{ mt: 1 }}
              />
            )}
            
            {task.error && (
              <Alert severity="error" sx={{ mt: 1, py: 0.5 }}>
                <Typography variant="caption">{task.error}</Typography>
              </Alert>
            )}
            
            {task.metadata && (
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                {Object.entries(task.metadata).map(([key, value]) => (
                  <Typography key={key} variant="caption" color="text.secondary">
                    {key}: {value}
                  </Typography>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
};