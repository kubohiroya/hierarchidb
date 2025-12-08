import { Alert, Box, Chip, Stack, Typography } from '@mui/material';
import type { RouteUpdaterPayload } from '../../../common/entities/RouteEntity.js';
import { useTranslation } from '../../../common/i18n/index.js';

interface RouteBuildStepProps {
  draft: RouteUpdaterPayload;
}

const toList = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  return [];
};

export const RouteBuildStep: React.FC<RouteBuildStepProps> = ({ draft: draftProp }) => {
  const { t } = useTranslation();
  const draft = draftProp.draftData ?? {};
  const routeType = (draft as { routeType?: string }).routeType ?? 'unknown';
  const transportModes = toList((draft as { transportModes?: unknown }).transportModes);
  const hasRequiredFields = Boolean(routeType && transportModes.length);

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <Typography variant="body2" color="text.secondary">
        {t('build.review', 'Review the configuration and press Build to start the batch route generation.')}
      </Typography>

      <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
        <Typography variant="subtitle2">{t('build.routeType', 'Route Type:')}</Typography>
        <Chip size="small" label={String(routeType)} />
      </Stack>

      <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
        <Typography variant="subtitle2">{t('build.transportModes', 'Transport Modes:')}</Typography>
        {transportModes.length ? (
          transportModes.map((mode) => <Chip key={mode} size="small" label={mode} />)
        ) : (
          <Chip size="small" label={t('build.notConfigured', 'Not configured')} />
        )}
      </Stack>

      {!hasRequiredFields && (
        <Alert severity="info">
          {t('build.missing', 'Provide a name, route type, and at least one transport mode before building.')}
        </Alert>
      )}

      <Alert severity="success">
        {t('build.start', 'When ready, click the Build button below to start the batch session.')}
      </Alert>
    </Box>
  );
};
