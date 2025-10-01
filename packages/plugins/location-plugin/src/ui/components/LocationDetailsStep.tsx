import type React from 'react';
import { Box, FormControlLabel, MenuItem, Select, Stack, Switch, TextField, Typography } from '@mui/material';
import { StorageRounded, Tune } from '@mui/icons-material';
import type { LocationWorkingCopy } from '../../types/index.js';
import { useTranslation } from '../../i18n/index.js';

const DATA_SOURCES = ['openstreetmap', 'geonames', 'wikidata', 'overpass'] as const;

type ProcessingConfig = NonNullable<LocationWorkingCopy['processingConfig']>;

const DEFAULT_PROCESSING_CONFIG: ProcessingConfig = {
  concurrentDownloads: 2,
  enableLocationFiltering: false,
  enableClustering: false,
  enableGeocoding: false,
};

export interface LocationDetailsStepProps {
  workingCopy: LocationWorkingCopy;
  onUpdate: (patch: Partial<LocationWorkingCopy>) => void;
  disabled?: boolean;
}

export const LocationDetailsStep: React.FC<LocationDetailsStepProps> = ({ workingCopy, onUpdate, disabled = false }) => {
  const { translations } = useTranslation();
  const processing = {
    ...DEFAULT_PROCESSING_CONFIG,
    ...(workingCopy.processingConfig ?? {}),
  };

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 640, margin: '0 auto' }}>
      <Box display="flex" alignItems="center" gap={1}>
        <StorageRounded color="primary" />
        <Typography variant="h6">{translations.details?.title ?? translations.dialog.dataSourceLabel}</Typography>
      </Box>

      <Stack spacing={2}>
        <Select
          label={translations.dialog.dataSourceLabel}
          value={workingCopy.dataSourceName ?? 'openstreetmap'}
          onChange={(event) => onUpdate({ dataSourceName: event.target.value as LocationWorkingCopy['dataSourceName'] })}
          disabled={disabled}
        >
          {DATA_SOURCES.map((source) => (
            <MenuItem key={source} value={source}>
              {source}
            </MenuItem>
          ))}
        </Select>

        <FormControlLabel
          control={(
            <Switch
              checked={Boolean(workingCopy.licenseAgreement)}
              onChange={(event) => onUpdate({ licenseAgreement: event.target.checked })}
              disabled={disabled}
            />
          )}
          label={translations.dialog.licenseAgreementLabel}
        />
      </Stack>

      <Box display="flex" alignItems="center" gap={1}>
        <Tune color="primary" />
        <Typography variant="subtitle1">{translations.details?.processingTitle ?? 'Processing Settings'}</Typography>
      </Box>

      <Stack spacing={1.5}>
        <TextField
          type="number"
          label={translations.details?.concurrency ?? translations.panel.concurrentDownloads}
          value={processing.concurrentDownloads}
          onChange={(event) => onUpdate({
            processingConfig: {
              ...processing,
              concurrentDownloads: Math.max(1, Math.min(8, Number(event.target.value) || 1)),
            },
          })}
          disabled={disabled}
          inputProps={{ min: 1, max: 8 }}
        />

        <FormControlLabel
          control={(
            <Switch
              checked={processing.enableLocationFiltering}
              onChange={(event) => onUpdate({
                processingConfig: { ...processing, enableLocationFiltering: event.target.checked },
              })}
              disabled={disabled}
            />
          )}
          label={translations.panel.filtering}
        />
        <FormControlLabel
          control={(
            <Switch
              checked={processing.enableClustering}
              onChange={(event) => onUpdate({
                processingConfig: { ...processing, enableClustering: event.target.checked },
              })}
              disabled={disabled}
            />
          )}
          label={translations.panel.clustering}
        />
        <FormControlLabel
          control={(
            <Switch
              checked={processing.enableGeocoding}
              onChange={(event) => onUpdate({
                processingConfig: { ...processing, enableGeocoding: event.target.checked },
              })}
              disabled={disabled}
            />
          )}
          label={translations.panel.geocoding}
        />
      </Stack>
    </Box>
  );
};
