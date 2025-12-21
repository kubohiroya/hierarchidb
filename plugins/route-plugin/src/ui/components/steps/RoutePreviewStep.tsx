/**
 * RoutePreviewStep - Step 6 of route creation dialog.
 */

import type React from 'react';
import { Alert, Box, Typography } from '@mui/material';
import type { RouteUpdaterPayload } from '../../../common/entities/RouteEntity.js';
import { useTranslation } from '../../../common/i18n/index.js';

interface RoutePreviewStepProps {
  draft: RouteUpdaterPayload;
}

export const RoutePreviewStep: React.FC<RoutePreviewStepProps> = ({ draft }) => {
  const { t } = useTranslation();
  const hasGeometry = Array.isArray(draft.draftData?.lineGeometry) && draft.draftData?.lineGeometry.length > 0;

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <Typography variant="h6">{t('preview.title', 'Preview')}</Typography>
      <Typography variant="body2" color="text.secondary">
        {t('preview.description', 'Preview the generated route geometry once the build is complete.')}
      </Typography>

      {!hasGeometry && (
        <Alert severity="info">
          {t('preview.missing', 'No route geometry is available yet. Run Build to generate a preview.')}
        </Alert>
      )}

      {hasGeometry && (
        <Alert severity="success">
          {t('preview.ready', 'Route geometry is available. Map preview will appear here.')}
        </Alert>
      )}
    </Box>
  );
};
