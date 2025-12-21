import { useMemo, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { BuildStepPanel, type BuildStatus } from '@hierarchidb/components';
import type { LocationEntity } from '../../../common/types/index.js';
import { useTranslation } from '../../../common/i18n/index.js';

type Props = {
  nodeId?: string;
  draft: Partial<LocationEntity>;
};

const STAGES: Array<{ id: string; title: string; description: string }> = [
  { id: 'prepare', title: 'Prepare', description: 'Validate inputs and stage tasks.' },
  { id: 'fetch', title: 'Fetch', description: 'Download points and metadata.' },
  { id: 'tile', title: 'Tile', description: 'Generate vector tiles for selections.' },
  { id: 'finalize', title: 'Finalize', description: 'Persist results and indexes.' },
];

export const LocationBuildStep: React.FC<Props> = ({ nodeId, draft }) => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<BuildStatus>('idle');
  const [overallProgress, setOverallProgress] = useState(0);

  const stageProgress = useMemo(() => {
    const map: Record<string, number> = {};
    STAGES.forEach((stage, idx) => {
      map[stage.id] = Math.min(100, Math.max(0, overallProgress - idx * 10));
    });
    return map;
  }, [overallProgress]);

  const hasPrerequisites = Boolean(nodeId && draft.dataSource);

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      <Box>
        <Typography variant="h6" gutterBottom>
          {t('build.title', 'Build vector tiles')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {hasPrerequisites
            ? t(
              'build.description',
              'Review progress and control the build. Use the footer Build button to start when prerequisites are met.'
            )
            : t('build.prereq', 'Select a data source and complete previous steps before building.')}
        </Typography>
      </Box>

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
