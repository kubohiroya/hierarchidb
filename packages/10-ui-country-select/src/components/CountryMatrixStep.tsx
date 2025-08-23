/**
 * @fileoverview CountryMatrixStep - Step component for use in multi-step dialogs
 * @module @hierarchidb/ui-country-select/components
 */

import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  Alert,
  Stack,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Info as InfoIcon,
} from '@mui/icons-material';

import { CountryMatrixSelector } from './CountryMatrixSelector';
import type { Country, CountryFilter } from '../types/Country';
import type { MatrixConfig, MatrixSelection, ColumnSet } from '../types/MatrixColumn';

export interface CountryMatrixStepProps {
  /** Step title */
  title?: string;
  /** Step description */
  description?: string;
  /** Available countries */
  countries: Country[];
  /** Matrix configuration or column set */
  matrixConfig: MatrixConfig | ColumnSet;
  /** Current selections */
  selections: MatrixSelection[];
  /** Callback when selections change */
  onSelectionsChange: (selections: MatrixSelection[]) => void;
  /** Initial filter */
  initialFilter?: CountryFilter;
  /** Component height */
  height?: number;
  /** Show validation info */
  showValidationInfo?: boolean;
  /** Minimum required selections */
  minSelections?: number;
  /** Show configuration accordion */
  showConfiguration?: boolean;
}

/**
 * CountryMatrixStep - Ready-to-use step component for multi-step dialogs
 * 
 * This component wraps CountryMatrixSelector with additional UI elements
 * suitable for use in multi-step workflows like StepperDialog.
 */
export const CountryMatrixStep: React.FC<CountryMatrixStepProps> = ({
  title = 'Select Countries and Options',
  description,
  countries,
  matrixConfig: rawMatrixConfig,
  selections,
  onSelectionsChange,
  initialFilter,
  height = 500,
  showValidationInfo = true,
  minSelections = 1,
  showConfiguration = false,
}) => {
  // Convert ColumnSet to MatrixConfig if needed
  const matrixConfig: MatrixConfig = useMemo(() => {
    if ('type' in rawMatrixConfig) {
      // It's a ColumnSet, convert to MatrixConfig
      return {
        columns: rawMatrixConfig.columns,
        allowBulkSelect: true,
        showColumnHeaders: true,
        showFilters: true,
        virtualization: {
          rowHeight: 56,
          overscan: 5,
        },
      };
    }
    return rawMatrixConfig;
  }, [rawMatrixConfig]);

  // Calculate selection statistics
  const stats = useMemo(() => {
    const totalCountries = countries.length;
    const selectedCountries = selections.length;
    const totalSelections = selections.reduce((sum, selection) => {
      return sum + Object.values(selection.selections).filter(Boolean).length;
    }, 0);

    return {
      totalCountries,
      selectedCountries,
      totalSelections,
      isValid: selectedCountries >= minSelections,
    };
  }, [countries, selections, minSelections]);

  // Get column set info if available
  const columnSetInfo = useMemo(() => {
    if ('type' in rawMatrixConfig) {
      return {
        name: rawMatrixConfig.name,
        description: rawMatrixConfig.description,
        type: rawMatrixConfig.type,
      };
    }
    return null;
  }, [rawMatrixConfig]);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        
        {description && (
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {description}
          </Typography>
        )}

        {/* Column set info */}
        {columnSetInfo && (
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>{columnSetInfo.name}:</strong> {columnSetInfo.description}
            </Typography>
          </Alert>
        )}
      </Box>

      {/* Configuration accordion */}
      {showConfiguration && (
        <Accordion sx={{ mb: 2 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <InfoIcon fontSize="small" />
              <Typography variant="body2">Configuration Details</Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={2}>
              <Typography variant="body2">
                <strong>Available Columns:</strong>
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={1}>
                {matrixConfig.columns.map(column => (
                  <Chip
                    key={column.id}
                    label={column.label}
                    size="small"
                    variant={column.defaultEnabled ? 'filled' : 'outlined'}
                    icon={column.icon ? <column.icon fontSize="small" /> : undefined}
                  />
                ))}
              </Stack>
              
              {columnSetInfo && (
                <>
                  <Typography variant="body2">
                    <strong>Column Set Type:</strong> {columnSetInfo.type}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Total Countries Available:</strong> {countries.length}
                  </Typography>
                </>
              )}
            </Stack>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Selection statistics */}
      {showValidationInfo && (
        <Box sx={{ mb: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              label={`${stats.selectedCountries} countries selected`}
              color={stats.isValid ? 'success' : 'default'}
              size="small"
            />
            <Chip
              label={`${stats.totalSelections} total selections`}
              variant="outlined"
              size="small"
            />
            {!stats.isValid && (
              <Chip
                label={`Minimum ${minSelections} required`}
                color="warning"
                size="small"
              />
            )}
          </Stack>
        </Box>
      )}

      {/* Main selector */}
      <CountryMatrixSelector
        countries={countries}
        matrixConfig={matrixConfig}
        selections={selections}
        onSelectionsChange={onSelectionsChange}
        initialFilter={initialFilter}
        height={height}
        showBulkTools={true}
        showCountryInfo={true}
      />

      {/* Validation message */}
      {showValidationInfo && !stats.isValid && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          Please select at least {minSelections} {minSelections === 1 ? 'country' : 'countries'} to continue.
        </Alert>
      )}
    </Box>
  );
};