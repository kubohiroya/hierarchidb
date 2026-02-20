/**
 * Location Selection Step
 */

import type React from 'react';
import { Suspense } from 'react';
import { Alert, Box, CircularProgress, Typography } from '@mui/material';
import type { LocationEntity, LocationType } from '~/common/types/index';
import { useTranslation } from '~/common/i18n/index';
import { CountryMatrixSelector, type MatrixSelection } from '@hierarchidb/ui-country-select';
import { AuthReadyGate } from '@hierarchidb/ui-auth';
import { useLocationSelectionStep } from './useLocationSelectionStep.ts';

interface LocationSelectionStepProps {
  draft: Partial<LocationEntity>;
  onUpdate: (updates: Partial<LocationEntity>) => void;
}

type SelectionColumn = {
  id: string;
};

export const buildSelectionRecord = (
  countryCodes: string[],
  columns: SelectionColumn[],
  nextSelections: MatrixSelection[],
  allowedTypeSet: Set<LocationType>,
): Record<string, boolean[]> => {
  const normalized: Record<string, boolean[]> = {};
  countryCodes.forEach((countryCode) => {
    const entry = nextSelections.find((sel) => sel.countryCode === countryCode);
    const selections = entry?.selections ?? {};
    normalized[countryCode] = columns.map((col) => {
      const allowed = allowedTypeSet.has(col.id as LocationType);
      return allowed ? Boolean(selections[col.id]) : false;
    });
  });

  return normalized;
};

const LocationSelectionContent: React.FC<LocationSelectionStepProps> = ({ draft, onUpdate }) => {
  const {
    t,
    iso,
    matrixConfig,
    currentSelections,
    applySelections,
    isCellEnabled,
  } = useLocationSelectionStep({ draft, onUpdate, buildSelectionRecord });

  if (iso.status === 'loading') {
    return (
      <Box>
        <Alert severity="info">{t('selection.loadingCountries', 'Loading countries...')}</Alert>
      </Box>
    );
  }

  if (iso.status === 'error') {
    const message = 'message' in iso ? iso.message : '';
    return (
      <Box>
        <Alert severity="error">
          {t('selection.loadError', 'Failed to load country list')}: {message}
        </Alert>
      </Box>
    );
  }

  if (iso.status !== 'ready' || iso.countries.length === 0) {
    return (
      <Box>
        <Alert severity="warning">
          {t('selection.emptyCountries', 'No countries available. Please try again later.')}
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
        isCellEnabled={isCellEnabled}
        height="100%"
        maxHeight={undefined}
      />
    </Box>
  );
};

export const LocationSelectionStep: React.FC<LocationSelectionStepProps> = (props) => {
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
        <LocationSelectionContent {...props} />
      </AuthReadyGate>
    </Suspense>
  );
};
