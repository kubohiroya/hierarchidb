import { useCallback, useEffect, useState, type FC, type ReactNode } from 'react';
import { BuildStageFilterProvider } from './BuildStepStageFilterContext.tsx';
import { BuildStepStageSummaryPanel, type BuildStepStageTaskCount } from './BuildStepStageSummaryPanel.js';

export type BuildStage = {
  id: string;
  title: string;
  description?: string;
  icon?: ReactNode;
};

export type BuildStepStagePanelProps = {
  stage: BuildStage;
  progress: number;
  content?: ReactNode;
  taskCount?: BuildStepStageTaskCount;
};

export const BuildStepStagePanel: FC<BuildStepStagePanelProps> = ({
  stage,
  progress,
  content,
  taskCount,
}) => {
  const [failedMode, setFailedMode] = useState(true);
  const [completedMode, setCompletedMode] = useState(true);
  const [resolvedTaskCount, setResolvedTaskCount] = useState<BuildStepStageTaskCount>({
    Completed: 0,
    Failed: 0,
    Skip: 0,
  });

  useEffect(() => {
    if (taskCount) {
      setResolvedTaskCount(taskCount);
      return;
    }
    setResolvedTaskCount({
      Completed: 0,
      Failed: 0,
      Skip: 0,
    });
  }, [taskCount]);

  const handleFailedModeUpdate = useCallback((newMode: boolean) => {
    setFailedMode(newMode);
  }, []);

  const handleCompletedModeUpdate = useCallback((newMode: boolean) => {
    setCompletedMode(newMode);
  }, []);

  const stageContent = content
    ? (
      <BuildStageFilterProvider value={{ failedMode, completedMode }}>
        {content}
      </BuildStageFilterProvider>
    )
    : null;

  return (
    <BuildStepStageSummaryPanel
      title={stage.title}
      description={stage.description}
      progress={progress}
      taskCount={resolvedTaskCount}
      failedMode={failedMode}
      onFailedModeUpdate={handleFailedModeUpdate}
      completedMode={completedMode}
      onCompletedModeUpdate={handleCompletedModeUpdate}
    >
      {stageContent}
    </BuildStepStageSummaryPanel>
  );
};
