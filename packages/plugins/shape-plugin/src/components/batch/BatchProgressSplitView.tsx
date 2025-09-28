import { Box, Card, CardContent, Chip, LinearProgress, Stack, Typography } from '@mui/material';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import { BatchTaskStage, type DownloadTask, type ProcessingConfig, type SimplifyTask, type VectorTileTask } from '../../shared';
import { TaskMonitor } from './TaskMonitor.js';

// Temporary JSX typing workaround for Allotment with React 19 types
interface BatchProgressSplitViewProps {
  config: ProcessingConfig;
  downloadTasks: DownloadTask[];
  simplify1Tasks: SimplifyTask[];
  simplify2Tasks: SimplifyTask[];
  vectorTileTasks: VectorTileTask[];
  onCancelTask: (taskId: string) => void;
  onResumeTask: (taskId: string) => void;
}

export const BatchProgressSplitView: React.FC<BatchProgressSplitViewProps> = ({
                                                                                config,
                                                                                downloadTasks,
                                                                                simplify1Tasks,
                                                                                simplify2Tasks,
                                                                                vectorTileTasks,
                                                                                onCancelTask,
                                                                                onResumeTask,
                                                                              }) => {
  // Calculate progress for each stage
  const calculateProgress = <T extends { stage: BatchTaskStage }>(tasks: T[]) => {
    if (tasks.length === 0) {
      return 0;
    }
    const completed = tasks.filter((task) => task.stage === BatchTaskStage.SUCCESS).length;
    return Math.round((completed / tasks.length) * 100);
  };

  const stages = [
    {
      title: `Download Shape Data (${config.concurrentDownloads} concurrent)`,
      tasks: downloadTasks,
      progress: calculateProgress(downloadTasks),
      color: 'primary' as const,
    },
    {
      title: 'Feature Processing',
      tasks: simplify1Tasks,
      progress: calculateProgress(simplify1Tasks),
      color: 'secondary' as const,
    },
    {
      title: 'Tile Simplification',
      tasks: simplify2Tasks,
      progress: calculateProgress(simplify2Tasks),
      color: 'warning' as const,
    },
    {
      title: `Vector Tiles (${config.concurrentProcesses} concurrent)`,
      tasks: vectorTileTasks,
      progress: calculateProgress(vectorTileTasks),
      color: 'success' as const,
    },
  ];

  return (
    <Box sx={{ height: '100%', width: '100%' }}>
      <Allotment vertical={false} proportionalLayout={false}>
        {stages.map((stage, index) => (
          <Allotment.Pane key={index} minSize={200}>
            <Box
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                p: 2,
              }}
            >
              {/* Stage Header */}
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Stack spacing={2}>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Typography variant="subtitle1" fontWeight="medium">
                        {stage.title}
                      </Typography>
                      <Chip
                        label={`${stage.progress}%`}
                        size="small"
                        color={stage.progress === 100 ? 'success' : stage.color}
                      />
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={stage.progress}
                      color={stage.color}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {
                        stage.tasks.filter((task) => task.stage === BatchTaskStage.SUCCESS).length
                      }{' '}
                      / {stage.tasks.length} completed
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>

              {/* Task List */}
              <Box sx={{ flex: 1, overflowY: 'auto' }}>
                <TaskMonitor
                  tasks={stage.tasks}
                  onCancelTask={onCancelTask}
                  onResumeTask={onResumeTask}
                />
              </Box>
            </Box>
          </Allotment.Pane>
        ))}
      </Allotment>
    </Box>
  );
};
