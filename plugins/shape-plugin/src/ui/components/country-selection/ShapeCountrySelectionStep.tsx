import React from 'react';
import { Alert, Box, CircularProgress, IconButton, Tooltip, Typography } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { CountryMatrixSelector } from '@hierarchidb/ui-country-select';
import { useShapeCountrySelectionStep } from './useShapeCountrySelectionStep.js';
import { useTranslation } from '@hierarchidb/ui-i18n';
import type { NodeId } from '@hierarchidb/core-types';
import { AuthReadyGate } from '@hierarchidb/ui-auth';
import type { ShapeDialogStepProps } from '~/ui/components/ShapeDialogStepProps';
import { useShapeCountrySelectionContentView } from './useShapeCountrySelectionContentView.js';

const ShapeCountrySelectionContent: React.FC<ShapeDialogStepProps> = ({ data, onChange, nodeId }) => {
  const { t } = useTranslation('shape-plugin');
  const {
    loading,
    error,
    availabilityInfo,
    matrixConfig,
    countries,
    selections,
    applySelections,
    isCellEnabled,
    reloadAll,
  } = useShapeCountrySelectionStep({ data, onChange, nodeId: nodeId as NodeId });
  const { metadataReloadTooltip } = useShapeCountrySelectionContentView({
    fetchedAt: availabilityInfo?.fetchedAt,
    t,
  });

  if (error) {
    return (
      <Alert severity="error">
        {t('countrySelection.loadError', 'Failed to load country metadata: {{message}}', { message: error.message })}
      </Alert>
    );
  }

  if (loading) {
    return (
      <Box sx={{ height: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>
          {t('countrySelection.loading', 'Loading country metadata...')}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, height: '100%', minHeight: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          <Typography variant="h6" gutterBottom>
            {t('countrySelection.title', 'Select Countries & Administrative Levels')}
          </Typography>
        </Box>
        <Tooltip title={metadataReloadTooltip}>
          <span>
            <IconButton
              size="small"
              onClick={() => void reloadAll()}
              disabled={loading}
              aria-label={String(t('countrySelection.reload', 'Reload'))}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      <Typography variant="body2" color="text.secondary" paragraph>
        {t(
          'countrySelection.description',
          'Select countries and their administrative levels to download. Use the matrix to make precise selections.',
        )}
      </Typography>

      <Box sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <CountryMatrixSelector
          countries={countries}
          matrixConfig={matrixConfig}
          selections={selections}
          onSelectionsChange={applySelections}
          isCellEnabled={(country, columnId) => isCellEnabled(country.code, columnId)}
          rowHeight={40}
          height="100%"
          maxHeight={undefined}
          showRegionIndex
          showAlphabetIndex
          scrollBehavior="smooth"
          indexScrollDurationMs={120}
          loading={loading}
          errorMessage={null}
        />
      </Box>
    </Box>
  );
};

export const ShapeCountrySelectionStep: React.FC<ShapeDialogStepProps> = (props) => {
  const { t } = useTranslation('shape-plugin');
  return (
    <React.Suspense
      fallback={
        <Box sx={{ height: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress />
          <Typography sx={{ ml: 2 }}>
            {t('auth.loading', 'Checking authentication...')}
          </Typography>
        </Box>
      }
    >
      <AuthReadyGate>
        <ShapeCountrySelectionContent {...props} />
      </AuthReadyGate>
    </React.Suspense>
  );
};
