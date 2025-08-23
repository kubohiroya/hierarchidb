import { useState, useEffect, useCallback } from 'react';
import type { NodeId } from '@hierarchidb/00-core';
import type { 
  DownloadTask, 
  SimplifyTask, 
  VectorTileTask,
  ProcessingConfig,
  UrlMetadata,
  BatchTaskStage,
} from '~/types';
import { mockShapeService } from '~/services/MockShapeService';
import { 
  generateMockDownloadTasks,
  generateMockSimplifyTasks,
  generateMockVectorTileTasks,
} from '~/mock/data';

// Union type for all task types
type AnyTask = DownloadTask | SimplifyTask | VectorTileTask;
type TaskSetter<T extends AnyTask> = React.Dispatch<React.SetStateAction<T[]>>;

interface UseBatchWorkerConsoleProps {
  id: NodeId;
  config: ProcessingConfig;
  urlMetadata: UrlMetadata[];
  onError?: (error: string) => void;
}

interface UseBatchWorkerConsoleReturn {
  downloadTasks: DownloadTask[];
  simplify1Tasks: SimplifyTask[];
  simplify2Tasks: SimplifyTask[];
  vectorTileTasks: VectorTileTask[];
  canStart: boolean;
  hasStarted: boolean;
  hasFinished: boolean;
  handleStart: () => Promise<void>;
  handleCancelTask: (taskId: string) => void;
  handleResumeTask: (taskId: string) => void;
  handleStopAll: () => void;
}

export const useBatchWorkerConsole = ({
  id,
  config,
  urlMetadata,
  onError,
}: UseBatchWorkerConsoleProps): UseBatchWorkerConsoleReturn => {
  const [_batchId, setBatchId] = useState<string | null>(null);
  const [downloadTasks, setDownloadTasks] = useState<DownloadTask[]>([]);
  const [simplify1Tasks, setSimplify1Tasks] = useState<SimplifyTask[]>([]);
  const [simplify2Tasks, setSimplify2Tasks] = useState<SimplifyTask[]>([]);
  const [vectorTileTasks, setVectorTileTasks] = useState<VectorTileTask[]>([]);
  const [hasStarted, setHasStarted] = useState(false);

  // Generate initial mock tasks
  useEffect(() => {
    if (urlMetadata.length > 0) {
      setDownloadTasks(generateMockDownloadTasks(urlMetadata));
      const countries = [...new Set(urlMetadata.map(m => m.countryCode))];
      const levels = [...new Set(urlMetadata.map(m => m.adminLevel))];
      setSimplify1Tasks(generateMockSimplifyTasks(countries, levels));
      setSimplify2Tasks(
        generateMockSimplifyTasks(countries, levels).map(task => ({
          ...task,
          taskId: task.taskId.replace('simplify1', 'simplify2'),
          taskType: 'simplify2' as const,
        }))
      );
      setVectorTileTasks(generateMockVectorTileTasks(countries, levels));
    }
  }, [urlMetadata]);

  // Simulate task progress
  useEffect(() => {
    if (!hasStarted) return;

    const interval = setInterval(() => {
      // Update download tasks
      setDownloadTasks(prev => prev.map(task => {
        if (task.stage === 'wait' && Math.random() < 0.1) {
          return { ...task, stage: 'process' as BatchTaskStage, progress: 0 };
        }
        if (task.stage === 'process') {
          const newProgress = Math.min((task.progress || 0) + Math.random() * 20, 100);
          if (newProgress >= 100) {
            return { ...task, stage: 'success' as BatchTaskStage, progress: 100, completedAt: Date.now() };
          }
          return { ...task, progress: newProgress };
        }
        return task;
      }));

      // Update simplify1 tasks
      setSimplify1Tasks(prev => prev.map(task => {
        if (task.stage === 'wait' && downloadTasks.some(d => d.stage === 'success') && Math.random() < 0.1) {
          return { ...task, stage: 'process' as BatchTaskStage, progress: 0 };
        }
        if (task.stage === 'process') {
          const newProgress = Math.min((task.progress || 0) + Math.random() * 15, 100);
          if (newProgress >= 100) {
            return { ...task, stage: 'success' as BatchTaskStage, progress: 100, completedAt: Date.now() };
          }
          return { ...task, progress: newProgress };
        }
        return task;
      }));

      // Similar updates for simplify2 and vectorTile tasks...
    }, 1000);

    return () => clearInterval(interval);
  }, [hasStarted, downloadTasks]);

  const canStart = urlMetadata.length > 0;
  
  const hasFinished = 
    downloadTasks.length > 0 &&
    downloadTasks.every(t => t.stage === 'success' || t.stage === 'error' || t.stage === 'cancel') &&
    simplify1Tasks.every(t => t.stage === 'success' || t.stage === 'error' || t.stage === 'cancel') &&
    simplify2Tasks.every(t => t.stage === 'success' || t.stage === 'error' || t.stage === 'cancel') &&
    vectorTileTasks.every(t => t.stage === 'success' || t.stage === 'error' || t.stage === 'cancel');

  const handleStart = useCallback(async () => {
    try {
      const result = await mockShapeService.startBatchProcessing(id, config, urlMetadata);
      setBatchId(result.batchId);
      setHasStarted(true);
    } catch (error) {
      onError?.(`Failed to start batch: ${error}`);
    }
  }, [id, config, urlMetadata, onError]);

  const handleCancelTask = useCallback((taskId: string) => {
    // Update task state to pause
    const updateTaskState = <T extends AnyTask>(_tasks: T[], setter: TaskSetter<T>) => {
      setter((prev: T[]) => prev.map(task => 
        task.taskId === taskId && task.stage === 'process' 
          ? { ...task, stage: 'pause' as BatchTaskStage }
          : task
      ));
    };

    updateTaskState(downloadTasks, setDownloadTasks);
    updateTaskState(simplify1Tasks, setSimplify1Tasks);
    updateTaskState(simplify2Tasks, setSimplify2Tasks);
    updateTaskState(vectorTileTasks, setVectorTileTasks);
  }, []);

  const handleResumeTask = useCallback((taskId: string) => {
    // Update task state back to process
    const updateTaskState = <T extends AnyTask>(_tasks: T[], setter: TaskSetter<T>) => {
      setter((prev: T[]) => prev.map(task => 
        task.taskId === taskId && task.stage === 'pause' 
          ? { ...task, stage: 'process' as BatchTaskStage }
          : task
      ));
    };

    updateTaskState(downloadTasks, setDownloadTasks);
    updateTaskState(simplify1Tasks, setSimplify1Tasks);
    updateTaskState(simplify2Tasks, setSimplify2Tasks);
    updateTaskState(vectorTileTasks, setVectorTileTasks);
  }, []);

  const handleStopAll = useCallback(() => {
    const stopTasks = (setter: any) => {
      setter((prev: any[]) => prev.map(task => 
        (task.stage === 'process' || task.stage === 'wait')
          ? { ...task, stage: 'cancel' as BatchTaskStage }
          : task
      ));
    };

    stopTasks(setDownloadTasks);
    stopTasks(setSimplify1Tasks);
    stopTasks(setSimplify2Tasks);
    stopTasks(setVectorTileTasks);
  }, []);

  return {
    downloadTasks,
    simplify1Tasks,
    simplify2Tasks,
    vectorTileTasks,
    canStart,
    hasStarted,
    hasFinished,
    handleStart,
    handleCancelTask,
    handleResumeTask,
    handleStopAll,
  };
};