import type React from 'react';
import { Alert, Box, CircularProgress, Typography } from '@mui/material';
import { CountryMatrixSelector } from '@hierarchidb/ui-country-select';
import type { ShapeDialogStepProps } from './ShapeDialogStepProps.ts';
import { useShapeCountrySelectionStep } from '../../hooks/useShapeCountrySelectionStep.js';

export const ShapeCountrySelectionStep: React.FC<ShapeDialogStepProps> = ({ data, onChange, }) => {
  const {
    loading,
    error,
    matrixConfig,
    countries,
    selections,
    applySelections,
    isCellEnabled,
  } = useShapeCountrySelectionStep({ data, onChange });

  if (loading) {
    return (
      <Box sx={{ height: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading country metadata...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">Failed to load country metadata: {error.message}</Alert>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, height: '100%', minHeight: 0 }}>
      <Typography variant="h6" gutterBottom>
        Select Countries & Administrative Levels
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Select countries and their administrative levels to download. Use the matrix to make precise selections.
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
          loading={loading}
          errorMessage={null}
        />
      </Box>
    </Box>
  );
};
