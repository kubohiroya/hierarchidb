/**
 * Location Selection Step
 */

import type React from 'react';
import { useCallback, useMemo, useState, useId } from 'react';
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
import type { LocationEntity } from '../../../common/types/index.js';
import { useTranslation } from '../../../common/i18n/index.js';
import { SelectionMatrix, type SelectionMatrixColumn, type SelectionMatrixRow } from '@hierarchidb/components';
import type { LocationType } from '../../../common/types/index.js';

interface LocationSelectionStepProps {
  draft: Partial<LocationEntity>;
  onUpdate: (updates: Partial<LocationEntity>) => void;
}

const SAMPLE_COUNTRIES = [
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
] satisfies Array<{ code: string; name: string; localName?: string; continent: string }>;

const DEFAULT_LOCATION_TYPES = [
  { id: 'area_centroid' as LocationType, icon: '🎯', color: '#6A5ACD', name: 'area_centroid', description: 'area_centroid', estimatedCount: 20000 },
  { id: 'airport' as LocationType, icon: '✈️', color: '#2196F3', name: 'airport', description: 'airport', estimatedCount: 28000 },
  { id: 'port' as LocationType, icon: '🚢', color: '#FF9800', name: 'port', description: 'port', estimatedCount: 12000 },
  { id: 'railway_station' as LocationType, icon: '🚉', color: '#4CAF50', name: 'railway_station', description: 'railway_station', estimatedCount: 45000 },
  { id: 'interchange' as LocationType, icon: '🛣️', color: '#607D8B', name: 'interchange', description: 'interchange', estimatedCount: 15000 },
] satisfies Array<{
  id: LocationType;
  icon: string;
  color: string;
  name: string;
  description: string;
  estimatedCount?: number;
}>;

export function normalizeMatrix(matrix: boolean[][] | undefined, countries: typeof SAMPLE_COUNTRIES, types: typeof DEFAULT_LOCATION_TYPES): boolean[][] {
  const safe = matrix ?? [];
  return countries.map((_, rowIndex) => {
    const row = safe[rowIndex] ?? [];
    return types.map((__, columnIndex) => Boolean(row[columnIndex]));
  });
}

export const LocationSelectionStep: React.FC<LocationSelectionStepProps> = ({ draft, onUpdate }) => {
  const { translations, t } = useTranslation();
  const selectionTranslations = translations.selection ?? {};
  const selectionSettings = translations.selectionSettings ?? {};
  const airportSettings = selectionSettings.airport ?? {};
  const railwaySettings = selectionSettings.railwayStation ?? {};
  const controlId = useId();
  const [activeTab, setActiveTab] = useState(0);

  const locationTypes = useMemo(() => {
    const typeLabels = translations.locationTypes ?? {};
    const descriptions = selectionTranslations.typeDescriptions ?? {};
    return DEFAULT_LOCATION_TYPES.map((t) => {
      const name = typeLabels[t.id] ?? t.name;
      const descriptionKey = t.id as keyof typeof descriptions;
      return {
        id: t.id,
        icon: t.icon,
        color: t.color,
        name,
        description: descriptions[descriptionKey] ?? name,
        estimatedCount: t.estimatedCount,
      };
    });
  }, [selectionTranslations.typeDescriptions, translations.locationTypes]);

  const columns = useMemo<SelectionMatrixColumn[]>(() => {
    const typeLabels = translations.locationTypes ?? {};
    const descriptions = selectionTranslations.typeDescriptions ?? {};
    return DEFAULT_LOCATION_TYPES.map((t) => {
      const name = typeLabels[t.id] ?? t.name;
      const descriptionKey = t.id as keyof typeof descriptions;
      return {
        id: t.id,
        label: `${t.icon} ${name}`,
        description: descriptions[descriptionKey] ?? name,
      };
    });
  }, [selectionTranslations.typeDescriptions, translations.locationTypes]);

  const selectionMatrixSource = useMemo(() => draft.selectionMatrix ?? [], [draft.selectionMatrix]);

  const selectionMatrix = useMemo(() => (
    normalizeMatrix(selectionMatrixSource, SAMPLE_COUNTRIES, DEFAULT_LOCATION_TYPES)
  ), [selectionMatrixSource]);

  const rows = useMemo<SelectionMatrixRow[]>(() => (
    SAMPLE_COUNTRIES.map((country) => ({
      id: country.code,
      label: country.name,
      subLabel: country.localName,
      data: country,
    }))
  ), []);

  const handleChange = useCallback(
    (rowIndex: number, colIndex: number, checked: boolean) => {
      const next = selectionMatrix.map((row, rIdx) =>
        row.map((cell, cIdx) => (rIdx === rowIndex && cIdx === colIndex ? checked : cell))
      );
      onUpdate({ selectionMatrix: next });
    },
    [onUpdate, selectionMatrix],
  );

  const handleSelectAllColumn = useCallback(
    (_colIndex: number, checked: boolean, enabledRowIndices: number[]) => {
      const next = selectionMatrix.map((row, rIdx) =>
        row.map((cell, cIdx) =>
          cIdx === _colIndex && enabledRowIndices.includes(rIdx) ? checked : cell
        )
      );
      onUpdate({ selectionMatrix: next });
    },
    [onUpdate, selectionMatrix],
  );

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const activeType = locationTypes[activeTab];

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 3 }}>
        {selectionTranslations.alertMessage ?? 'Select the regions and location types you want to include.'}
      </Alert>

      <Box mb={2} display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="h6">{selectionTranslations.matrixTitle ?? 'Location Coverage Matrix'}</Typography>
        <Typography variant="body2" color="text.secondary">
          {(selectionTranslations.selectedCount ?? 'Selected')}: {selectionMatrix.flat().filter(Boolean).length}
        </Typography>
      </Box>

      <Box mb={3}>
        <SelectionMatrix
          rows={rows}
        columns={columns}
        state={selectionMatrix}
        onChange={handleChange}
        onSelectAll={handleSelectAllColumn}
        rowHeaderLabel={t('selectionMatrix.columnHeader', 'Country / Type')}
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
              {selectionSettings.generic?.advancedFilters ?? 'Configure advanced filters for this type.'}
            </Typography>

            {activeType.id === 'airport' && (
              <Grid container spacing={3} columns={{ xs: 12 }}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControlLabel
                    control={(
                      <Switch
                        defaultChecked
                        inputProps={{
                          id: `${controlId}-airport-include-heliports`,
                          name: 'airport-include-heliports',
                        }}
                      />
                    )}
                    label={airportSettings.includeHeliports ?? 'Include heliports'}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControlLabel
                    control={(
                      <Switch
                        defaultChecked
                        inputProps={{
                          id: `${controlId}-airport-active-only`,
                          name: 'airport-active-only',
                        }}
                      />
                    )}
                    label={airportSettings.activeOnly ?? 'Active airports only'}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControlLabel
                    control={(
                      <Switch
                        inputProps={{
                          id: `${controlId}-airport-commercial-only`,
                          name: 'airport-commercial-only',
                        }}
                      />
                    )}
                    label={airportSettings.commercialOnly ?? 'Commercial airports only'}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Box>
                    <Typography gutterBottom>
                      {(airportSettings.minRunwayLengthLabel ?? 'Minimum runway length: {value} m').replace('{value}', '1500')}
                    </Typography>
                    <Slider min={300} max={5000} step={100} defaultValue={1500} />
                  </Box>
                </Grid>
              </Grid>
            )}

            {activeType.id === 'railway_station' && (
              <Grid container spacing={3} columns={{ xs: 12 }}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControlLabel
                    control={(
                      <Switch
                        defaultChecked
                        inputProps={{
                          id: `${controlId}-railway-include-metro`,
                          name: 'railway-include-metro',
                        }}
                      />
                    )}
                    label={railwaySettings.includeMetro ?? 'Include metro/light rail'}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControlLabel
                    control={(
                      <Switch
                        inputProps={{
                          id: `${controlId}-railway-include-abandoned`,
                          name: 'railway-include-abandoned',
                        }}
                      />
                    )}
                    label={railwaySettings.includeAbandoned ?? 'Include abandoned lines'}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControlLabel
                    control={(
                      <Switch
                        inputProps={{
                          id: `${controlId}-railway-intercity-only`,
                          name: 'railway-intercity-only',
                        }}
                      />
                    )}
                    label={railwaySettings.intercityOnly ?? 'Intercity only'}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    type="number"
                    label={railwaySettings.minPlatformsLabel ?? 'Minimum platforms'}
                    defaultValue={1}
                    size="small"
                    id={`${controlId}-railway-min-platforms`}
                    name="railway-min-platforms"
                    inputProps={{
                      id: `${controlId}-railway-min-platforms`,
                      name: 'railway-min-platforms',
                    }}
                  />
                </Grid>
              </Grid>
            )}
          </Box>
        )}
      </Paper>
    </Box>
  );
};
