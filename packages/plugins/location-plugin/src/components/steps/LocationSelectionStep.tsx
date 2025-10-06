/**
 * Location Selection Step
 */

import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Grid,
  Paper,
  Tabs,
  Tab,
  Typography,
  FormControlLabel,
  Switch,
  Slider,
  TextField,
} from '@mui/material';
import { Settings } from '@mui/icons-material';
import type { LocationWorkingCopy } from '../../types/index.js';
import { useTranslation } from '../../i18n/index.js';
import { SelectionMatrix, type Country, type LocationTypeConfig } from '../ui/SelectionMatrix.js';
import type { LocationType } from '../../types/index.js';

interface LocationSelectionStepProps {
  workingCopy: LocationWorkingCopy;
  onUpdate: (updates: Partial<LocationWorkingCopy['draft']>) => void;
}

const SAMPLE_COUNTRIES: Country[] = [
  { code: 'JPN', name: 'Japan', localName: 'Nihon', continent: 'Asia' },
  { code: 'KOR', name: 'South Korea', localName: 'Daehanminguk', continent: 'Asia' },
  { code: 'CHN', name: 'China', localName: 'Zhongguo', continent: 'Asia' },
  { code: 'TWN', name: 'Taiwan', continent: 'Asia' },
  { code: 'USA', name: 'United States', continent: 'North America' },
  { code: 'GBR', name: 'United Kingdom', continent: 'Europe' },
  { code: 'DEU', name: 'Germany', localName: 'Deutschland', continent: 'Europe' },
  { code: 'FRA', name: 'France', continent: 'Europe' },
  { code: 'ITA', name: 'Italy', localName: 'Italia', continent: 'Europe' },
  { code: 'ESP', name: 'Spain', localName: 'España', continent: 'Europe' },
  { code: 'CAN', name: 'Canada', continent: 'North America' },
];

const DEFAULT_LOCATION_TYPES: LocationTypeConfig[] = [
  { id: 'airport' as LocationType, icon: '✈️', color: '#2196F3', name: 'airport', description: 'airport', estimatedCount: 28000 },
  { id: 'railway_station' as LocationType, icon: '🚆', color: '#4CAF50', name: 'railway_station', description: 'railway_station', estimatedCount: 45000 },
  { id: 'port' as LocationType, icon: '🚢', color: '#FF9800', name: 'port', description: 'port', estimatedCount: 12000 },
  { id: 'interchange' as LocationType, icon: '🛣️', color: '#607D8B', name: 'interchange', description: 'interchange', estimatedCount: 15000 },
  { id: 'tourist_attraction' as LocationType, icon: '📍', color: '#9C27B0', name: 'tourist_attraction', description: 'tourist_attraction', estimatedCount: 8000 },
  { id: 'park' as LocationType, icon: '🌳', color: '#2E7D32', name: 'park', description: 'park', estimatedCount: 32000 },
];

export function buildCheckboxState(
  matrix: boolean[][],
  countries: Country[],
  locationTypes: LocationTypeConfig[],
): Record<string, Partial<Record<LocationType, boolean>>> {
  const state: Record<string, Partial<Record<LocationType, boolean>>> = {};

  countries.forEach((country, rowIndex) => {
    const row = matrix[rowIndex] ?? [];
    row.forEach((isSelected, columnIndex) => {
      if (!isSelected) return;
      const type = locationTypes[columnIndex]?.id;
      if (!type) return;
      const entry = state[country.code] ?? (state[country.code] = {});
      entry[type] = true;
    });
  });

  return state;
}

export function normalizeMatrix(matrix: boolean[][] | undefined, countries: Country[], types: LocationTypeConfig[]): boolean[][] {
  const safe = matrix ?? [];
  return countries.map((_, rowIndex) => {
    const row = safe[rowIndex] ?? [];
    return types.map((__, columnIndex) => Boolean(row[columnIndex]));
  });
}

export const LocationSelectionStep: React.FC<LocationSelectionStepProps> = ({ workingCopy, onUpdate }) => {
  const { translations } = useTranslation();
  const [activeTab, setActiveTab] = useState(0);

  const locationTypes = useMemo<LocationTypeConfig[]>(() => {
    const typeLabels = translations.locationTypes;
    const descriptions = translations.selection.typeDescriptions ?? {};
    return DEFAULT_LOCATION_TYPES.map((t) => {
      const name = typeLabels[t.id] ?? t.name;
      const descriptionKey = t.id as keyof typeof descriptions;
      return {
        ...t,
        name,
        description: descriptions[descriptionKey] ?? name,
      };
    });
  }, [translations]);

  const selectionMatrixSource = useMemo(() => workingCopy.draft.selectionMatrix ?? [], [workingCopy.draft.selectionMatrix]);

  const selectionMatrix = useMemo(() => (
    normalizeMatrix(selectionMatrixSource, SAMPLE_COUNTRIES, locationTypes)
  ), [locationTypes, selectionMatrixSource]);

  const handleMatrixChange = useCallback((matrix: boolean[][]) => {
    onUpdate({ selectionMatrix: matrix });
  }, [onUpdate]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const activeType = locationTypes[activeTab];

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 3 }}>
        {translations.selection.alertMessage}
      </Alert>

      <Box mb={2} display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="h6">{translations.selection.matrixTitle}</Typography>
        <Typography variant="body2" color="text.secondary">
          {translations.selection.selectedCount}: {selectionMatrix.flat().filter(Boolean).length}
        </Typography>
      </Box>

      <Box mb={3}>
        <SelectionMatrix
          countries={SAMPLE_COUNTRIES}
          locationTypes={locationTypes}
          value={selectionMatrix}
          onChange={handleMatrixChange}
        />
      </Box>

      <Paper elevation={1} sx={{ p: 3 }}>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <Settings color="primary" />
          <Typography variant="h6">{translations.selection.settingsTitle}</Typography>
        </Box>
        {translations.selection.settingsDescription && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {translations.selection.settingsDescription}
          </Typography>
        )}

        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
        >
          {locationTypes.map((type) => (
            <Tab
              key={type.id}
              label={(
                <Box display="flex" alignItems="center" gap={1}>
                  <span>{type.icon}</span>
                  <span>{type.name}</span>
                </Box>
              )}
            />
          ))}
        </Tabs>

        {activeType && (
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              {activeType.icon} {activeType.description}
            </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {translations.selectionSettings.generic?.advancedFilters ?? 'Configure advanced filters for this type.'}
          </Typography>

            {activeType.id === 'airport' && (
              <Grid container spacing={3} columns={{ xs: 12 }}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControlLabel control={<Switch defaultChecked />} label={translations.selectionSettings.airport.includeHeliports} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControlLabel control={<Switch defaultChecked />} label={translations.selectionSettings.airport.activeOnly} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControlLabel control={<Switch />} label={translations.selectionSettings.airport.commercialOnly} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Box>
                    <Typography gutterBottom>
                      {translations.selectionSettings.airport.minRunwayLengthLabel.replace('{value}', '1500')}
                    </Typography>
                    <Slider min={300} max={5000} step={100} defaultValue={1500} />
                  </Box>
                </Grid>
              </Grid>
            )}

            {activeType.id === 'railway_station' && (
              <Grid container spacing={3} columns={{ xs: 12 }}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControlLabel control={<Switch defaultChecked />} label={translations.selectionSettings.railwayStation.includeMetro} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControlLabel control={<Switch />} label={translations.selectionSettings.railwayStation.includeAbandoned} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControlLabel control={<Switch />} label={translations.selectionSettings.railwayStation.intercityOnly} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField type="number" label={translations.selectionSettings.railwayStation.minPlatformsLabel} defaultValue={1} size="small" />
                </Grid>
              </Grid>
            )}
          </Box>
        )}
      </Paper>
    </Box>
  );
};
