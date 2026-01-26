/**
 * Location Data Source Selection Step
 */

import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Close, InsertDriveFile } from '@mui/icons-material';
import { Box, Button, Dialog, DialogContent, IconButton, Stack, Typography } from '@mui/material';
import {
  DataSourceSelectionStep,
  type DataSourceSelectionOption,
  type DataSourceSelectorProps,
} from '@hierarchidb/ui-datasource';
import { FileInputWithUrl } from '@hierarchidb/ui-file';
import type { LocationDataSource, LocationEntity, LocationType } from '../../../common/types/index.js';
import { useTranslation } from '../../../common/i18n/index.js';
import type { Timestamp } from '@hierarchidb/common-types';

const ORDERED_DATA_SOURCES: LocationDataSource[] = [
  'ide-gsm',
  'openstreetmap',
  'overpass',
  'geonames',
  'wikidata',
  'ourairports',
  'openflights',
  'world-port-index',
  'natural-earth',
  'custom',
  'manual',
];

interface LocationDataSourceStepProps {
  draft: Partial<LocationEntity>;
  onUpdate: (updates: Partial<LocationEntity>) => void;
  licenseRequired?: boolean;
  disabled?: boolean;
}

const LICENSE_DETAILS: Record<
  LocationDataSource,
  { licenseName: string; licenseUrl?: string; attribution?: string }
> = {
  openstreetmap: {
    licenseName: 'ODbL 1.0',
    licenseUrl: 'https://opendatacommons.org/licenses/odbl/',
    attribution: '© OpenStreetMap contributors',
  },
  overpass: {
    licenseName: 'ODbL 1.0',
    licenseUrl: 'https://opendatacommons.org/licenses/odbl/',
    attribution: '© OpenStreetMap contributors',
  },
  geonames: {
    licenseName: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attribution: 'Data provided by GeoNames',
  },
  wikidata: {
    licenseName: 'CC0 1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    attribution: 'Data from Wikidata contributors',
  },
  ourairports: {
    licenseName: 'Public Domain',
    licenseUrl: 'https://ourairports.com/data/',
    attribution: 'Data courtesy of OurAirports.com',
  },
  openflights: {
    licenseName: 'ODbL 1.0',
    licenseUrl: 'https://opendatacommons.org/licenses/odbl/',
    attribution: 'OpenFlights project',
  },
  'world-port-index': {
    licenseName: 'Public Domain',
    licenseUrl: 'https://msi.nga.mil/Publications/WPI',
    attribution: 'World Port Index (U.S. National Geospatial-Intelligence Agency)',
  },
  'natural-earth': {
    licenseName: 'Public Domain',
    licenseUrl: 'https://www.naturalearthdata.com/about/terms-of-use/',
    attribution: 'Map data by Natural Earth',
  },
  'ide-gsm': {
    licenseName: 'IDE-GSM License',
    licenseUrl: undefined,
    attribution: undefined,
  },
  custom: {
    licenseName: 'Custom terms',
    licenseUrl: undefined,
    attribution: undefined,
  },
  manual: {
    licenseName: 'User provided',
    licenseUrl: undefined,
    attribution: undefined,
  },
};

const SOURCE_DESCRIPTIONS: Record<LocationDataSource, string> = {
  openstreetmap: 'OpenStreetMap default pipeline for general points',
  overpass: 'OpenStreetMap Overpass API for custom queries',
  geonames: 'GeoNames worldwide place names with population attributes',
  wikidata: 'Wikidata places and facilities (community maintained)',
  ourairports: 'OurAirports global airport database (public domain)',
  openflights: 'OpenFlights airport dataset with IATA/ICAO codes',
  'world-port-index': 'World Port Index (NGA) major ports worldwide',
  'natural-earth': 'Natural Earth populated places and transport hubs',
  'ide-gsm': 'IDE-GSM CSV files provided by your organization',
  custom: 'Upload your own tabular dataset',
  manual: 'Enter locations manually',
};

const TYPE_ICONS: Record<string, string> = {
  area_centroid: '🎯',
  airport: '✈️',
  port: '🚢',
  railway_station: '🚉',
  interchange: '🛣️',
};

const SOURCE_TYPES: Partial<Record<LocationDataSource, LocationType[]>> = {
  openstreetmap: ['area_centroid', 'airport', 'port', 'railway_station', 'interchange'],
  overpass: ['area_centroid', 'airport', 'port', 'railway_station', 'interchange'],
  geonames: ['area_centroid', 'airport', 'port'],
  wikidata: ['area_centroid', 'airport', 'port', 'railway_station', 'interchange'],
  ourairports: ['airport'],
  openflights: ['airport'],
  'world-port-index': ['port'],
  'natural-earth': ['area_centroid', 'airport', 'port'],
  'ide-gsm': ['area_centroid', 'airport', 'port', 'railway_station', 'interchange'],
};

const DISABLED_SOURCES: LocationDataSource[] = ORDERED_DATA_SOURCES.filter(
  (sourceId) => sourceId !== 'ide-gsm',
);

const HIDDEN_SOURCES: LocationDataSource[] = ['custom', 'manual'];

export const LocationDataSourceStep: React.FC<LocationDataSourceStepProps> = ({
  draft,
  onUpdate,
  licenseRequired = true,
  disabled,
}) => {
  const { t } = useTranslation();
  const [localDialogOpen, setLocalDialogOpen] = useState(false);
  const [remoteDialogOpen, setRemoteDialogOpen] = useState(false);

  const value = useMemo<LocationDataSource>(
    () => (draft.dataSource as LocationDataSource) ?? 'openstreetmap',
    [draft.dataSource]
  );

  const options = useMemo<DataSourceSelectionOption[]>(
    () =>
      ORDERED_DATA_SOURCES.filter((sourceId) => !HIDDEN_SOURCES.includes(sourceId)).map((sourceId) => {
        const license = LICENSE_DETAILS[sourceId];
        return {
          id: sourceId,
          name: t(`dataSource.options.${sourceId}.name`, sourceId),
          description: SOURCE_DESCRIPTIONS[sourceId],
          licenseName: license?.licenseName ?? 'License',
          licenseUrl: license?.licenseUrl,
          attribution: license?.attribution,
          disabled: DISABLED_SOURCES.includes(sourceId),
        };
      }),
    [t]
  );

  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (
        blobUrlRef.current &&
        blobUrlRef.current.startsWith('blob:') &&
        blobUrlRef.current !== draft.ideGsmSourceUrl
      ) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [draft.ideGsmSourceUrl]);

  const description = t('dataSource.description', 'Choose a dataset source to fetch location data.');
  const hasIdeGsmFile = Boolean(draft.ideGsmFileName || draft.ideGsmSourceUrl);
  const ideGsmFileLabel =
    draft.ideGsmFileName ??
    draft.ideGsmSourceUrl ??
    t('dataSource.ideGsm.fileFallback', 'Imported file');

  const closeDialogs = () => {
    setLocalDialogOpen(false);
    setRemoteDialogOpen(false);
  };

  const handleIdeGsmFileSelect = async (file: File, downloadUrl?: string) => {
    if (blobUrlRef.current && blobUrlRef.current.startsWith('blob:')) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    const sourceUrl = downloadUrl ?? URL.createObjectURL(file);
    if (!downloadUrl) {
      blobUrlRef.current = sourceUrl;
    }
    const updates: Partial<LocationEntity> = {
      ideGsmFileName: file.name,
      ideGsmSourceUrl: sourceUrl,
      selectedArrayByCountries: {},
      ideGsmSelectionHash: undefined,
    };
    onUpdate(updates);
    closeDialogs();
  };

  const handleClearIdeGsmFile = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (blobUrlRef.current && blobUrlRef.current.startsWith('blob:')) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    onUpdate({
      ideGsmFileName: undefined,
      ideGsmSourceUrl: undefined,
      selectedArrayByCountries: {},
      ideGsmSelectionHash: undefined,
    });
  };

  const renderOption: DataSourceSelectorProps['renderOption'] = (option, active) => {
    const supported =
      SOURCE_TYPES[option.id as LocationDataSource] ?? SOURCE_TYPES.openstreetmap ?? [];
    const icons = supported
      .map((type) => TYPE_ICONS[type] ?? '')
      .filter(Boolean)
      .join(' ');
    const isIdeGsm = option.id === 'ide-gsm';
    return (
      <Stack spacing={0.5}>
        <Typography variant="subtitle1">
          {option.icon} {option.name}
        </Typography>
        {option.description && (
          <Typography variant="body2" color="text.secondary">
            {option.description}
          </Typography>
        )}
        <Box display="flex" gap={1} alignItems="center">
          <Typography variant="caption" color="text.secondary">
            Supported types:
          </Typography>
          <Typography variant="caption">{icons}</Typography>
        </Box>
        {isIdeGsm && active ? (
          <Box
            sx={{
              mt: 1.5,
              p: 1.5,
              borderRadius: 1,
              border: 1,
              borderColor: 'divider',
              bgcolor: 'background.default',
            }}
          >
            {hasIdeGsmFile ? (
              <Box display="flex" alignItems="center" justifyContent="space-between" gap={1}>
                <Box display="flex" alignItems="center" gap={1} sx={{ minWidth: 0 }}>
                  <InsertDriveFile fontSize="small" color="action" />
                  <Typography variant="body2" noWrap title={ideGsmFileLabel}>
                    {ideGsmFileLabel}
                  </Typography>
                </Box>
                <IconButton
                  size="small"
                  aria-label={t('dataSource.ideGsm.removeFile', 'Remove imported file')}
                  onClick={handleClearIdeGsmFile}
                  disabled={Boolean(disabled)}
                >
                  <Close fontSize="small" />
                </IconButton>
              </Box>
            ) : (
              <Stack spacing={1}>
                <Typography variant="body2" color="text.secondary">
                  {t('dataSource.ideGsm.noFiles', 'No CSV files imported.')}
                </Typography>
                <Stack
                  direction="row"
                  spacing={1}
                  useFlexGap
                  flexWrap="wrap"
                  onClick={(event) => event.stopPropagation()}
                >
                  <Button
                    variant="outlined"
                    color="secondary"
                    size="small"
                    disabled={Boolean(disabled)}
                    onClick={(event) => {
                      event.stopPropagation();
                      setLocalDialogOpen(true);
                    }}
                  >
                    {t('dataSource.ideGsm.importLocal', 'Import Local Files')}
                  </Button>
                  <Button
                    variant="outlined"
                    color="secondary"
                    size="small"
                    disabled={Boolean(disabled)}
                    onClick={(event) => {
                      event.stopPropagation();
                      setRemoteDialogOpen(true);
                    }}
                  >
                    {t('dataSource.ideGsm.importRemote', 'Import Remote Files')}
                  </Button>
                </Stack>
              </Stack>
            )}
          </Box>
        ) : null}
      </Stack>
    );
  };

  return (
    <Box>
      <DataSourceSelectionStep<Timestamp>
        title={t('dataSource.title', 'Data Source')}
        options={options}
        state={{
          dataSourceId: value,
          licenseAgreement: Boolean(draft.licenseAgreement),
          licenseAgreedAt: draft.licenseAgreedAt,
        }}
        onChange={(next) => {
          const nextSource = (next.dataSourceId as LocationDataSource | undefined) ?? value;
          const sourceChanged = nextSource !== value;
          onUpdate({
            dataSource: nextSource,
            licenseAgreement: next.licenseAgreement,
            licenseAgreedAt: next.licenseAgreedAt,
            ideGsmFileName: nextSource === 'ide-gsm' ? draft.ideGsmFileName : undefined,
            ideGsmSourceUrl: nextSource === 'ide-gsm' ? draft.ideGsmSourceUrl : undefined,
            ...(sourceChanged
              ? { selectedArrayByCountries: {}, ideGsmSelectionHash: undefined }
              : {}),
          });
        }}
        licenseRequired={licenseRequired}
        licenseRequiredText={t(
          'dataSource.licenseRequired',
          'License agreement is required to proceed.',
        )}
        disabled={disabled}
        description={description}
        renderOption={renderOption}
        createAgreedAt={() => Date.now() as Timestamp}
        selectionTitle={t('dataSource.selectionTitle', 'Data Source')}
        detailsTitle={t('dataSource.detailsTitle', 'Data Source Details')}
        showDetailsCard={false}
      />
      <Dialog
        open={localDialogOpen}
        onClose={() => setLocalDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, pt: 2 }}>
          <Typography variant="subtitle1">
            {t('dataSource.ideGsm.importLocal', 'Import Local Files')}
          </Typography>
          <IconButton
            aria-label={t('common.close', 'Close')}
            onClick={() => setLocalDialogOpen(false)}
          >
            <Close />
          </IconButton>
        </Box>
        <DialogContent sx={{ pt: 1.5 }}>
          <FileInputWithUrl
            accept=".csv,.xlsx,.xls"
            buttonLabel={t('dataSource.ideGsm.buttonLabel', 'Select IDE-GSM file')}
            instructions={t(
              'dataSource.ideGsm.instructions',
              'Provide an IDE-GSM CSV file via upload or URL.',
            )}
            onFileSelect={handleIdeGsmFileSelect}
            disabled={Boolean(disabled)}
            mode="local"
          />
        </DialogContent>
      </Dialog>
      <Dialog
        open={remoteDialogOpen}
        onClose={() => setRemoteDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, pt: 2 }}>
          <Typography variant="subtitle1">
            {t('dataSource.ideGsm.importRemote', 'Import Remote Files')}
          </Typography>
          <IconButton
            aria-label={t('common.close', 'Close')}
            onClick={() => setRemoteDialogOpen(false)}
          >
            <Close />
          </IconButton>
        </Box>
        <DialogContent sx={{ pt: 1.5 }}>
          <FileInputWithUrl
            accept=".csv,.xlsx,.xls"
            buttonLabel={t('dataSource.ideGsm.buttonLabel', 'Select IDE-GSM file')}
            instructions={t(
              'dataSource.ideGsm.instructions',
              'Provide an IDE-GSM CSV file via upload or URL.',
            )}
            defaultDownloadUrl={draft.ideGsmSourceUrl}
            onFileSelect={handleIdeGsmFileSelect}
            disabled={Boolean(disabled)}
            mode="url"
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
};
