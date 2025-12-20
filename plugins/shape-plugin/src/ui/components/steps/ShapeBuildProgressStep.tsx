import { useMemo, useState } from 'react';
import { Box } from '@mui/material';
import { BuildStepPanel, type BuildStatus } from '@hierarchidb/components';
import type { ShapeDialogStepProps } from './ShapeDialogStepProps.ts';

const STAGES = [
  { id: 'prepare', title: 'Prepare', description: 'Validate selections and metadata.' },
  { id: 'fetch', title: 'Fetch', description: 'Download and normalize shape data.' },
  { id: 'tile', title: 'Tile', description: 'Generate vector tiles for chosen admin levels.' },
  { id: 'finalize', title: 'Finalize', description: 'Persist outputs and indexes.' },
];

export const ShapeBuildProgressStep: React.FC<ShapeDialogStepProps> = (_props) => {
  const [status, setStatus] = useState<BuildStatus>('idle');
  const [overallProgress, setOverallProgress] = useState(0);

  const stageProgress = useMemo(() => {
    const map: Record<string, number> = {};
    STAGES.forEach((stage, idx) => {
      map[stage.id] = Math.min(100, Math.max(0, overallProgress - idx * 10));
    });
    return map;
  }, [overallProgress]);

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      <BuildStepPanel
        status={status}
        overallProgress={overallProgress}
        stages={STAGES}
        stageProgress={stageProgress}
        onPause={() => setStatus('paused')}
        onResume={() => setStatus('running')}
        onComplete={() => {
          setStatus('completed');
          setOverallProgress(100);
        }}
      />
    </Box>
  );
};
