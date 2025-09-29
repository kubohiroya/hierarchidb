/**
  * Location Selection Step
   */

import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Slider,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
  Grid,
} from '@mui/material';
import { Settings } from '@mui/icons-material';
import { LocationType, type LocationWorkingCopy } from '../../types/index.js';
import { type Country, type LocationTypeConfig, SelectionMatrix, type SelectionState } from '../ui/SelectionMatrix.js';
import { useTranslation } from '../../i18n/index.js';

interface LocationSelectionStepProps {
  workingCopy: LocationWorkingCopy;
  onUpdate: (_updates: Partial<LocationWorkingCopy>) => Promise<void>;
}

const SAMPLE_COUNTRIES: Country[] = [
  { code: 'INTL', name: 'Other (International/Maritime)', continent: 'International' },
  { code: 'JPN', name: 'Japan', localName: 'Nihon', continent: 'Asia' },
  { code: 'KOR', name: 'South Korea', localName: 'Daehanminguk', continent: 'Asia' },
  { code: 'CHN', name: 'China', localName: 'Zhongguo', continent: 'Asia' },
  { code: 'USA', name: 'United States', continent: 'North America' },
  { code: 'GBR', name: 'United Kingdom', continent: 'Europe' },
  { code: 'DEU', name: 'Germany', localName: 'Deutschland', continent: 'Europe' },
  { code: 'FRA', name: 'France', continent: 'Europe' },
  { code: 'ITA', name: 'Italy', localName: 'Italia', continent: 'Europe' },
  { code: 'ESP', name: 'Spain', localName: 'España', continent: 'Europe' },
  { code: 'CAN', name: 'Canada', continent: 'North America' },
  { code: 'AUS', name: 'Australia', continent: 'Oceania' },
  { code: 'BRA', name: 'Brazil', localName: 'Brasil', continent: 'South America' },
  { code: 'IND', name: 'India', localName: 'Bharat', continent: 'Asia' },
  { code: 'RUS', name: 'Russia', localName: 'Rossiya', continent: 'Europe' },
];

interface LocationTypeBaseConfig {
  id: LocationType;
  icon: string;
  color: string;
  estimatedCount?: number;
  descriptionKey: string;
}

const LOCATION_TYPE_BASE: LocationTypeBaseConfig[] = [
  { id: LocationType.AIRPORT, icon: '✈️', color: '#2196F3', descriptionKey: 'airport', estimatedCount: 28000 },
  { id: LocationType.RAILWAY_STATION, icon: '🚂', color: '#4CAF50', descriptionKey: 'railway_station', estimatedCount: 45000 },
  { id: LocationType.PORT, icon: '🚢', color: '#FF9800', descriptionKey: 'port', estimatedCount: 12000 },
  { id: LocationType.GOVERNMENT, icon: '🏛️', color: '#9C27B0', descriptionKey: 'government', estimatedCount: 8000 },
  { id: LocationType.INTERCHANGE, icon: '🛣️', color: '#607D8B', descriptionKey: 'interchange', estimatedCount: 15000 },
];

interface LocationTypeDetailConfig {
  airport: {
    includeHeliports: boolean;
    minRunwayLength: number;
    activeOnly: boolean;
    commercialOnly: boolean;
  };
  railway_station: {
    includeMetro: boolean;
    includeAbandoned: boolean;
    minPlatforms: number;
    intercityOnly: boolean;
  };
  port: {
    includeMarinas: boolean;
    cargoOnly: boolean;
    minDepth: number;
    activeOnly: boolean;
  };
  government: {
    adminLevels: number[];
    populationMin: number;
    capitalOnly: boolean;
    includeHistorical: boolean;
  };
  interchange: {
    includeInterchanges: boolean;
    namedOnly: boolean;
    excludeServiceAreas: boolean;
  };
}

const DEFAULT_TYPE_CONFIG: LocationTypeDetailConfig = {
  airport: {
    includeHeliports: false,
    minRunwayLength: 500,
    activeOnly: true,
    commercialOnly: false,
  },
  railway_station: {
    includeMetro: true,
    includeAbandoned: false,
    minPlatforms: 1,
    intercityOnly: false,
  },
  port: {
    includeMarinas: false,
    cargoOnly: false,
    minDepth: 5,
    activeOnly: true,
  },
  government: {
    adminLevels: [2, 4, 6],
    populationMin: 1000,
    capitalOnly: false,
    includeHistorical: false,
  },
  interchange: {
    includeInterchanges: true,
    namedOnly: false,
    excludeServiceAreas: false,
  },
};

export const LocationSelectionStep: React.FC<LocationSelectionStepProps> = ({
                                                                              workingCopy,
                                                                              onUpdate,
                                                                            }) => {
  const { translations } = useTranslation();
  const formatTemplate = useCallback((template: string, values: Record<string, string | number>) =>
    Object.entries(values).reduce((acc, [key, value]) => acc.replace(new RegExp(`{${key}}`, 'g'), String(value)), template),
  []);
  const locationTypes = useMemo<LocationTypeConfig[]>(() => LOCATION_TYPE_BASE.map((type) => ({
    id: type.id,
    icon: type.icon,
    color: type.color,
    estimatedCount: type.estimatedCount,
    name: translations.locationTypes[type.id] ?? type.id,
    description: translations.selection.typeDescriptions?.[type.descriptionKey] ?? '',
  })), [translations]);

  const [activeTab, setActiveTab] = useState(0);
  const [typeConfig, setTypeConfig] = useState<LocationTypeDetailConfig>(DEFAULT_TYPE_CONFIG);

  const selectionMatrix = useMemo(() => {
    // Convert checkboxState to boolean matrix format
    const matrix: boolean[][] = Array(SAMPLE_COUNTRIES.length).fill(null).map(() =>
      Array(locationTypes.length).fill(false),
    );

    // Fill matrix based on checkboxState
    Object.entries(workingCopy.checkboxState ?? {}).forEach(([countryCode, typeState]) => {
      const countryIndex = SAMPLE_COUNTRIES.findIndex(c => c.code === countryCode);
      if (countryIndex >= 0) {
        Object.entries(typeState as Record<string, boolean>).forEach(([typeId, selected]) => {
          const typeIndex = locationTypes.findIndex(t => t.id === typeId);
          if (typeIndex >= 0 && countryIndex < matrix.length) {
            matrix[countryIndex]![typeIndex] = !!selected;
          }
        });
      }
    });

    return matrix;
  }, [locationTypes, workingCopy.checkboxState]);

  const handleMatrixChange = useCallback(async () => {
    // Convert matrix to checkboxState format
    const checkboxState: Record<string, Record<LocationType, boolean>> = {};
    // TODO: Implement proper conversion logic
    await onUpdate({
      checkboxState,
    });
  }, [onUpdate]);

  const handleSelectionChange = useCallback(async (state: SelectionState) => {
    await onUpdate({
      selectedCountries: state.selectedCountries,
      locationTypes: state.selectedTypes,
    });
  }, [onUpdate]);

  const handleTypeConfigChange = (type: keyof LocationTypeDetailConfig, config: any) => {
    setTypeConfig(prev => ({
      ...prev,
      [type]: { ...prev[type], ...config },
    }));
  };

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const activeType = locationTypes[activeTab];

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 3 }}>
        {translations.selection.alertMessage}
      </Alert>

      {/*
*/}
      <Box mb={3}>
        <SelectionMatrix
          countries={SAMPLE_COUNTRIES}
          locationTypes={locationTypes}
          value={selectionMatrix}
          onChange={handleMatrixChange}
          onSelectionChange={handleSelectionChange}
        />
      </Box>

      {/*
*/}
      <Paper elevation={1} sx={{ p: 3 }}>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <Settings color="primary" />
          <Typography variant="h6">{translations.selection.settingsTitle}</Typography>
        </Box>

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
              label={
                <Box display="flex" alignItems="center" gap={1}>
                  <span>{type.icon}</span>
                  <span>{type.name}</span>
                </Box>
              }
            />
          ))}
        </Tabs>

        {/*
*/}
        {activeType && (
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              {activeType.icon} {formatTemplate(translations.selectionSettings.typeDetailTitle, { type: activeType.name })}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {activeType.description}
            </Typography>

            {/*
*/}
            {activeType.id === 'airport' && (
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={typeConfig.airport.includeHeliports}
                        onChange={(e) => handleTypeConfigChange('airport', { includeHeliports: e.target.checked })}
                      />
                    }
                    label={translations.selectionSettings.airport.includeHeliports}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={typeConfig.airport.activeOnly}
                        onChange={(e) => handleTypeConfigChange('airport', { activeOnly: e.target.checked })}
                      />
                    }
                    label={translations.selectionSettings.airport.activeOnly}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={typeConfig.airport.commercialOnly}
                        onChange={(e) => handleTypeConfigChange('airport', { commercialOnly: e.target.checked })}
                      />
                    }
                    label={translations.selectionSettings.airport.commercialOnly}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Box>
                    <Typography gutterBottom>
                      {formatTemplate(translations.selectionSettings.airport.minRunwayLengthLabel, {
                        value: typeConfig.airport.minRunwayLength,
                      })}
                    </Typography>
                    <Slider
                      value={typeConfig.airport.minRunwayLength}
                      onChange={(_, value) => handleTypeConfigChange('airport', { minRunwayLength: value })}
                      min={300}
                      max={5000}
                      step={100}
                      marks={[
                        { value: 500, label: translations.selectionSettings.airport.minRunwayLengthShort },
                        { value: 1500, label: translations.selectionSettings.airport.minRunwayLengthMedium },
                        { value: 3000, label: translations.selectionSettings.airport.minRunwayLengthLong },
                      ]}
                    />
                  </Box>
                </Grid>
              </Grid>
            )}

            {/*
*/}
            {activeType.id === 'railway_station' && (
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={typeConfig.railway_station.includeMetro}
                        onChange={(e) => handleTypeConfigChange('railway_station', { includeMetro: e.target.checked })}
                      />
                    }
                    label={translations.selectionSettings.railwayStation.includeMetro}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={typeConfig.railway_station.includeAbandoned}
                        onChange={(e) => handleTypeConfigChange('railway_station', { includeAbandoned: e.target.checked })}
                      />
                    }
                    label={translations.selectionSettings.railwayStation.includeAbandoned}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={typeConfig.railway_station.intercityOnly}
                        onChange={(e) => handleTypeConfigChange('railway_station', { intercityOnly: e.target.checked })}
                      />
                    }
                    label={translations.selectionSettings.railwayStation.intercityOnly}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    type="number"
                    label={translations.selectionSettings.railwayStation.minPlatformsLabel}
                    value={typeConfig.railway_station.minPlatforms}
                    onChange={(e) => handleTypeConfigChange('railway_station', { minPlatforms: parseInt(e.target.value) || 1 })}
                    size="small"
                    inputProps={{ min: 1, max: 20 }}
                  />
                </Grid>
              </Grid>
            )}

            {/*
*/}
            {activeType.id === 'port' && (
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={typeConfig.port.includeMarinas}
                        onChange={(e) => handleTypeConfigChange('port', { includeMarinas: e.target.checked })}
                      />
                    }
                    label={translations.selectionSettings.port.includeMarinas}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={typeConfig.port.cargoOnly}
                        onChange={(e) => handleTypeConfigChange('port', { cargoOnly: e.target.checked })}
                      />
                    }
                    label={translations.selectionSettings.port.cargoOnly}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={typeConfig.port.activeOnly}
                        onChange={(e) => handleTypeConfigChange('port', { activeOnly: e.target.checked })}
                      />
                    }
                    label={translations.selectionSettings.port.activeOnly}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    type="number"
                    label={translations.selectionSettings.port.minDepthLabel}
                    value={typeConfig.port.minDepth}
                    onChange={(e) => handleTypeConfigChange('port', { minDepth: parseFloat(e.target.value) || 5 })}
                    size="small"
                    inputProps={{ min: 1, max: 50, step: 0.5 }}
                  />
                </Grid>
              </Grid>
            )}

            {/*
*/}
            {activeType.id === 'government' && (
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>{translations.selectionSettings.administrative.adminLevelLabel}</InputLabel>
                    <Select
                      multiple
                      value={typeConfig.government.adminLevels}
                      onChange={(e) => handleTypeConfigChange('government', {
                        adminLevels: Array.isArray(e.target.value) ? e.target.value : [],
                      })}
                      label={translations.selectionSettings.administrative.adminLevelLabel}
                    >
                      <MenuItem value={2}>{formatTemplate(translations.selectionSettings.administrative.adminLevelCountry, { value: 2 })}</MenuItem>
                      <MenuItem value={4}>{formatTemplate(translations.selectionSettings.administrative.adminLevelState, { value: 4 })}</MenuItem>
                      <MenuItem value={6}>{formatTemplate(translations.selectionSettings.administrative.adminLevelCity, { value: 6 })}</MenuItem>
                      <MenuItem value={8}>{formatTemplate(translations.selectionSettings.administrative.adminLevelDistrict, { value: 8 })}</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    type="number"
                    label={translations.selectionSettings.administrative.minPopulationLabel}
                    value={typeConfig.government.populationMin}
                    onChange={(e) => handleTypeConfigChange('government', { populationMin: parseInt(e.target.value) || 1000 })}
                    size="small"
                    inputProps={{ min: 0, step: 1000 }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={typeConfig.government.capitalOnly}
                        onChange={(e) => handleTypeConfigChange('government', { capitalOnly: e.target.checked })}
                      />
                    }
                    label={translations.selectionSettings.administrative.capitalOnly}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={typeConfig.government.includeHistorical}
                        onChange={(e) => handleTypeConfigChange('government', { includeHistorical: e.target.checked })}
                      />
                    }
                    label={translations.selectionSettings.administrative.includeHistorical}
                  />
                </Grid>
              </Grid>
            )}

            {/*
*/}
            {activeType.id === LocationType.INTERCHANGE && (
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={typeConfig.interchange.includeInterchanges}
                        onChange={(e) => handleTypeConfigChange('interchange', { includeInterchanges: e.target.checked })}
                      />
                    }
                    label={translations.selectionSettings.interchange.includeInterchanges}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={typeConfig.interchange.namedOnly}
                        onChange={(e) => handleTypeConfigChange('interchange', { namedOnly: e.target.checked })}
                      />
                    }
                    label={translations.selectionSettings.interchange.namedOnly}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={typeConfig.interchange.excludeServiceAreas}
                        onChange={(e) => handleTypeConfigChange('interchange', { excludeServiceAreas: e.target.checked })}
                      />
                    }
                    label={translations.selectionSettings.interchange.excludeServiceAreas}
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
