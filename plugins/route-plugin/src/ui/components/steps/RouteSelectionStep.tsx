/**
 * RouteSelectionStep - Step 3 of route creation dialog.
 * Selects Route Selection per country, aligned with LocationSelectionStep UI.
 */

import type React from 'react';
import { Suspense } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import { useTranslation } from '@hierarchidb/ui-i18n';
import { CountryMatrixSelector } from '@hierarchidb/ui-country-select';
import { AuthReadyGate } from '@hierarchidb/ui-auth';
import { GenericDataGrid } from '@hierarchidb/ui-grid';
import {
  type RouteSelectionStepProps,
  useRouteSelectionStep,
} from './useRouteSelectionStep.js';

const RouteSelectionContent: React.FC<RouteSelectionStepProps> = (props) => {
  const {
    t,
    iso,
    draft,
    dataSourceName,
    isIdeGsm,
    coverage,
    coverageLoading,
    selectionErrorMessage,
    errorDialogOpen,
    setErrorDialogOpen,
    errorRows,
    errorColumns,
    matrixConfig,
    currentSelections,
    applySelections,
    isCellEnabledForCountry,
    policy,
  } = useRouteSelectionStep(props);

  if (iso.status === 'loading') {
    return (
      <Box>
        <Alert severity="info">{t('routeConfig.loadingCountries', 'Loading countries...')}</Alert>
      </Box>
    );
  }

  if (iso.status === 'error') {
    const message = 'message' in iso ? iso.message : '';
    return (
      <Box>
        <Alert severity="error">
          {t('routeConfig.loadError', 'Failed to load country list')}: {message}
        </Alert>
      </Box>
    );
  }

  if (iso.status !== 'ready' || iso.countries.length === 0) {
    return (
      <Box>
        <Alert severity="warning">
          {t('routeConfig.emptyCountries', 'No countries available. Please try again later.')}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <CountryMatrixSelector
        countries={iso.countries}
        matrixConfig={matrixConfig}
        selections={currentSelections}
        onSelectionsChange={applySelections}
        showRowSelection
        showAlphabetIndex
        showRegionIndex
        rowHeight={40}
        isCellEnabled={(country, columnId) => isCellEnabledForCountry(country.code, columnId)}
        loading={isIdeGsm && coverageLoading}
        errorMessage={selectionErrorMessage}
        height="100%"
        maxHeight={undefined}
      />
      {isIdeGsm && coverage?.errors?.length ? (
        <Box sx={{ mt: 1 }}>
          <Alert
            severity="error"
            action={(
              <Button color="inherit" size="small" onClick={() => setErrorDialogOpen(true)}>
                {t('routeConfig.ideGsmErrors.open', 'Details')}
              </Button>
            )}
          >
            {t('routeConfig.ideGsmErrors.summary', 'IDE-GSM parsing errors detected. Review the error list.')}
          </Alert>
        </Box>
      ) : null}
      <Dialog
        open={errorDialogOpen}
        onClose={() => setErrorDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{t('routeConfig.ideGsmErrors.title', 'IDE-GSM errors')}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {draft.ideGsmFileName ? (
            <Typography variant="body2" color="text.secondary">
              {t('routeConfig.ideGsmErrors.sourceLabel', 'Source')}: {draft.ideGsmFileName}
            </Typography>
          ) : null}
          <Typography variant="body2" color="text.secondary">
            {t('routeConfig.ideGsmErrors.description', 'Some routes could not be resolved. Check the rows below.')}
          </Typography>
          <Box sx={{ height: 360 }}>
            <GenericDataGrid
              columns={errorColumns}
              rows={errorRows}
              getRowId={(row) => row.id}
              enableVirtualization
              rowHeight={38}
              maxHeight={360}
              stickyHeader
              dense
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setErrorDialogOpen(false)} variant="contained">
            {t('common.close', 'Close')}
          </Button>
        </DialogActions>
      </Dialog>
      {policy.defaultChecked && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
          {t('routeConfig.defaultSelectionNote', 'Default selections are applied based on the data source.')}
        </Typography>
      )}
      {dataSourceName && !policy.defaultChecked && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
          {t('routeConfig.customSelectionNote', 'Choose the Route Selection to include for each country.')}
        </Typography>
      )}
    </Box>
  );
};

export const RouteSelectionStep: React.FC<RouteSelectionStepProps> = (props) => {
  const { t } = useTranslation('route-plugin');
  return (
    <Suspense
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
        <RouteSelectionContent {...props} />
      </AuthReadyGate>
    </Suspense>
  );
};
