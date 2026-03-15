import type { PluginStepProps } from '@hierarchidb/plugin-base';
import { TabularDataFilterStep } from '@hierarchidb/spreadsheet-plugin/ui';
import { AuthReadyGate } from '@hierarchidb/ui-auth';
import { Box, CircularProgress, Typography } from '@mui/material';
import { Suspense } from 'react';
import { useTranslation } from '@hierarchidb/ui-i18n';
import type { StylerStepData } from '~/common/types/StylerEntity';

export const StylerFilterStep: React.FC<PluginStepProps<StylerStepData>> = (props) => {
  const { t } = useTranslation('styler-plugin');
  return (
    <Suspense
      fallback={
        <Box
          sx={{ height: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <CircularProgress />
          <Typography sx={{ ml: 2 }}>{t('auth.loading', 'Checking authentication...')}</Typography>
        </Box>
      }
    >
      <AuthReadyGate>
        <TabularDataFilterStep {...props} translationNamespace="styler-plugin" />
      </AuthReadyGate>
    </Suspense>
  );
};
