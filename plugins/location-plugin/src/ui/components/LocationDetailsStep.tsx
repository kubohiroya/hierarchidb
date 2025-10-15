import type React from 'react';
import { Box, FormControlLabel, MenuItem, Select, Stack, Switch, TextField, Typography } from '@mui/material';
import { StorageRounded, Tune } from '@mui/icons-material';
import type { LocationWorkingCopy } from '../../common/types/index.js';
import { useTranslation } from '../../common/i18n/index.js';

const DATA_SOURCES = ['openstreetmap', 'geonames', 'wikidata', 'overpass'] as const;

type DataSourceValue = typeof DATA_SOURCES[number];

export interface LocationDetailsStepProps {
  workingCopy: LocationWorkingCopy;
  onUpdate: (patch: Partial<LocationWorkingCopy['draft']>) => void;
  disabled?: boolean;
}

export const LocationDetailsStep: React.FC<LocationDetailsStepProps> = ({ workingCopy, onUpdate, disabled = false }) => {
  const { translations } = useTranslation();
  const draft = workingCopy.draft ?? {};
  const dataSourceValue: DataSourceValue = (draft.dataSource as DataSourceValue) ?? 'openstreetmap';
  const concurrentDownloads = draft.concurrentDownloads ?? 2;
  const licenseAgreement = draft.licenseAgreement ?? false;

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 640, margin: '0 auto' }}>
      <Box display="flex" alignItems="center" gap={1}>
        <StorageRounded color="primary" />
        <Typography variant="h6">{translations.details?.title ?? translations.dialog.dataSourceLabel}</Typography>
      </Box>

      <Stack spacing={2}>
        <Select
          label={translations.dialog.dataSourceLabel}
          value={dataSourceValue}
          onChange={(event) => onUpdate({ dataSource: event.target.value as DataSourceValue })}
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
              checked={licenseAgreement}
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
          value={concurrentDownloads}
          onChange={(event) => onUpdate({
            concurrentDownloads: Math.max(1, Math.min(8, Number(event.target.value) || 1)),
          })}
          disabled={disabled}
          inputProps={{ min: 1, max: 8 }}
        />
      </Stack>
    </Box>
  );
};
