/**
 * RouteSelectionStep - Step 3 of route creation dialog.
 * Selects Route Selection per country, aligned with LocationSelectionStep UI.
 */

import type React from 'react';
import { Suspense } from 'react';
import {
  Alert,
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  MenuItem,
  Select,
  Slider,
  TextField,
  Typography,
} from '@mui/material';
import { ExpandMore } from '@mui/icons-material';
import type { RouteMode } from '@hierarchidb/route-api';
import { useTranslation } from '../../../common/i18n/index.js';
import { CountryMatrixSelector } from '@hierarchidb/ui-country-select';
import { AuthReadyGate } from '@hierarchidb/ui-auth';
import { GenericDataGrid } from '@hierarchidb/ui-grid';
import {
  LINE_WIDTH_MAX,
  LINE_WIDTH_MIN,
  ROUTE_MODE_COLUMNS,
  ROUTE_STYLE_OPTIONS,
  type RouteSelectionStepProps,
  useRouteSelectionStep,
} from './useRouteSelectionStep.js';

const RouteSelectionContent: React.FC<RouteSelectionStepProps> = (props) => {
  const {
    t,
    translations,
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
    resolveAllowedModesForCountry,
    policy,
    styleConfig,
    handleModeColorChange,
    handleLineWidthChange,
    handleLineStyleChange,
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
        isCellEnabled={(country, columnId) => resolveAllowedModesForCountry(country.code).has(columnId as RouteMode)}
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
      {translations && dataSourceName && !policy.defaultChecked && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
          {t('routeConfig.customSelectionNote', 'Choose the Route Selection to fetch for each country.')}
        </Typography>
      )}
      <Accordion sx={{ mt: 2 }}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Box>
            <Typography variant="subtitle1">
              {t('routeConfig.style.title', 'Route style')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('routeConfig.style.description', 'Configure colors and line styles per transport mode.')}
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="subtitle2">
              {t('routeConfig.style.modeColorsTitle', 'Mode colors')}
            </Typography>
            <Grid container spacing={2}>
              {ROUTE_MODE_COLUMNS.map((mode) => (
                <Grid key={mode.id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <mode.icon fontSize="small" />
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {t(mode.labelKey, mode.id)}
                    </Typography>
                    <TextField
                      type="color"
                      size="small"
                      value={styleConfig.modeColors[mode.id]}
                      onChange={(event) => handleModeColorChange(mode.id, event.target.value)}
                      inputProps={{ 'aria-label': t('routeConfig.style.modeColorLabel', 'Color') }}
                    />
                  </Box>
                </Grid>
              ))}
            </Grid>
            <Divider />
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="subtitle2" gutterBottom>
                  {t('routeConfig.style.lineWidthLabel', 'Line width')}
                </Typography>
                <Slider
                  min={LINE_WIDTH_MIN}
                  max={LINE_WIDTH_MAX}
                  value={styleConfig.lineWidth}
                  onChange={(_, next) => handleLineWidthChange(next)}
                  valueLabelDisplay="auto"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="subtitle2" gutterBottom>
                  {t('routeConfig.style.lineStyleLabel', 'Line style')}
                </Typography>
                <Select
                  fullWidth
                  size="small"
                  value={styleConfig.lineStyle}
                  onChange={(event) => handleLineStyleChange(String(event.target.value))}
                >
                  {ROUTE_STYLE_OPTIONS.map((option) => (
                    <MenuItem key={option.id} value={option.id}>
                      {t(option.labelKey, option.fallback)}
                    </MenuItem>
                  ))}
                </Select>
              </Grid>
            </Grid>
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};

export const RouteSelectionStep: React.FC<RouteSelectionStepProps> = (props) => {
  const { t } = useTranslation();
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
