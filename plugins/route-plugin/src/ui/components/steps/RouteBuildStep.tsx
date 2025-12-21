import { useMemo, useState } from 'react';
import { Alert, Box, Chip, Stack, Typography } from '@mui/material';
import { BuildStepPanel, type BuildStatus } from '@hierarchidb/components';
import type { RouteUpdaterPayload } from '../../../common/entities/RouteEntity.js';
import { useTranslation } from '../../../common/i18n/index.js';

interface RouteBuildStepProps {
  draft: RouteUpdaterPayload;
}

const STAGES = [
  { id: 'prepare', title: 'Prepare', description: 'Validate route parameters.' },
  { id: 'fetch', title: 'Fetch', description: 'Fetch route graph data.' },
  { id: 'compute', title: 'Compute', description: 'Calculate routes and metrics.' },
  { id: 'finalize', title: 'Finalize', description: 'Persist results and indexes.' },
];

const resolveTransportLabel = (draft: Record<string, unknown>, t: (key: string, fallback?: string) => string): string => {
  const metadata = (draft.metadata ?? {}) as Record<string, unknown>;
  const selection = typeof metadata.transportSelection === 'string' ? metadata.transportSelection : null;
  if (selection === 'high-speed-rail') return t('transportModes.highSpeedRail', 'High-speed rail');
  if (selection === 'rail') return t('transportModes.rail', 'Rail');
  if (selection === 'highway') return t('transportModes.highway', 'Highway');
  if (selection === 'road') return t('transportModes.road', 'General road');
  if (selection === 'sea') return t('transportModes.sea', 'Sea');
  if (selection === 'air') return t('transportModes.air', 'Air');

  const baseMode = typeof draft.transportMode === 'string' ? draft.transportMode : null;
  if (baseMode === 'air') return t('transportModes.air', 'Air');
  if (baseMode === 'sea') return t('transportModes.sea', 'Sea');
  if (baseMode === 'rail') return t('transportModes.rail', 'Rail');
  if (baseMode === 'road') return t('transportModes.road', 'General road');
  return t('build.notConfigured', 'Not configured');
};

export const RouteBuildStep: React.FC<RouteBuildStepProps> = ({ draft: draftProp }) => {
  const { t } = useTranslation();
  const draft = draftProp.draftData ?? {};
  const dataSource = (draft as { dataSourceName?: string }).dataSourceName ?? t('build.notConfigured', 'Not configured');
  const generationMethod = (draft as { generationMethod?: string }).generationMethod ?? t('build.notConfigured', 'Not configured');
  const transportLabel = resolveTransportLabel(draft as Record<string, unknown>, t);
  const startLocation = (draft as { startLocationId?: string }).startLocationId ?? t('build.notConfigured', 'Not configured');
  const endLocation = (draft as { endLocationId?: string }).endLocationId ?? t('build.notConfigured', 'Not configured');

  const hasRequiredFields = Boolean(
    (draft as { dataSourceName?: string }).dataSourceName &&
      (draft as { transportMode?: string }).transportMode &&
      (draft as { generationMethod?: string }).generationMethod &&
      (draft as { startLocationId?: string }).startLocationId &&
      (draft as { endLocationId?: string }).endLocationId,
  );

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
    <Box display="flex" flexDirection="column" gap={2}>
      <Typography variant="body2" color="text.secondary">
        {t('build.review', 'Review the configuration and press Build to start the batch route generation.')}
      </Typography>

      <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
        <Typography variant="subtitle2">{t('build.dataSource', 'Data Source:')}</Typography>
        <Chip size="small" label={String(dataSource)} />
      </Stack>

      <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
        <Typography variant="subtitle2">{t('build.transportMode', 'Transport Mode:')}</Typography>
        <Chip size="small" label={transportLabel} />
      </Stack>

      <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
        <Typography variant="subtitle2">{t('build.routeType', 'Route Type:')}</Typography>
        <Chip size="small" label={String(generationMethod)} />
      </Stack>

      <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
        <Typography variant="subtitle2">{t('build.startLocation', 'Start:')}</Typography>
        <Chip size="small" label={String(startLocation)} />
      </Stack>

      <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
        <Typography variant="subtitle2">{t('build.endLocation', 'End:')}</Typography>
        <Chip size="small" label={String(endLocation)} />
      </Stack>

      {!hasRequiredFields && (
        <Alert severity="info">
          {t('build.missing', 'Provide transport, route type, and start/end locations before building.')}
        </Alert>
      )}

      <Typography variant="subtitle1">
        {t('build.title', 'Build routes')}
      </Typography>
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
