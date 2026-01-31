/**
 * Location Data Source Selection Step
 */

import type React from 'react';
import { useMemo, useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material';
import {
  DataSourceSelectionStep,
  type DataSourceSelectionOption,
  type DataSourceSelectorProps,
  IdeGsmImportPanel,
  type IdeGsmFileEntry,
} from '@hierarchidb/ui-datasource';
import { useWorkerAPI } from '@hierarchidb/ui-worker-provider';
import type { LocationDataSource, LocationEntity, LocationType } from '../../../common/types/index.js';
import { useTranslation } from '../../../common/i18n/index.js';
import type { NodeId, Timestamp } from '@hierarchidb/core-types';

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
  nodeId?: NodeId;
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
  'ide-gsm': 'IDE-GSM schema represents city data',
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
  nodeId,
}) => {
  const { t } = useTranslation();
  const { api, initialize } = useWorkerAPI();
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [pendingRemoveIndex, setPendingRemoveIndex] = useState<number | null>(null);
  const [routeRefCount, setRouteRefCount] = useState<number | null>(null);
  const [routeRefLoading, setRouteRefLoading] = useState(false);
  const [routeRefError, setRouteRefError] = useState<string | null>(null);

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

  const description = t('dataSource.description', 'Choose a dataset source to fetch location data.');
  const ideGsmLabels = useMemo(
    () => ({
      importButton: t('dataSource.ideGsm.importButton', 'Import'),
      noFiles: t('dataSource.ideGsm.noFiles', 'No CSV files imported.'),
      importLocal: t('dataSource.ideGsm.importLocal', 'Import Local Files'),
      importRemote: t('dataSource.ideGsm.importRemote', 'Import Remote Files'),
      fileFallback: t('dataSource.ideGsm.fileFallback', 'Imported file'),
      removeFile: t('dataSource.ideGsm.removeFile', 'Remove imported file'),
      buttonLabel: t('dataSource.ideGsm.buttonLabel', 'Select IDE-GSM file'),
      instructions: t(
        'dataSource.ideGsm.instructions',
        'Provide an IDE-GSM CSV file via upload or URL.',
      ),
    }),
    [t],
  );
  const ideGsmSources = useMemo<IdeGsmFileEntry[]>(() => {
    if (draft.ideGsmSources && draft.ideGsmSources.length > 0) {
      return draft.ideGsmSources.map((entry) => ({
        ...entry,
        sourceType:
          entry.sourceType ??
          (entry.sourceUrl.startsWith('http://') || entry.sourceUrl.startsWith('https://')
            ? 'remote'
            : 'local'),
      }));
    }
    if (draft.ideGsmSourceUrl) {
      const sourceUrl = draft.ideGsmSourceUrl;
      return [{
        fileName: draft.ideGsmFileName ?? t('dataSource.ideGsm.fileFallback', 'Imported file'),
        sourceUrl,
        sourceType: sourceUrl.startsWith('http://') || sourceUrl.startsWith('https://') ? 'remote' : 'local',
      }];
    }
    return [];
  }, [draft.ideGsmFileName, draft.ideGsmSourceUrl, draft.ideGsmSources, t]);

  const requestRemoveFile = async (index: number) => {
    setPendingRemoveIndex(index);
    setRemoveDialogOpen(true);
    setRouteRefCount(null);
    setRouteRefError(null);
    if (!api || !nodeId) return;
    setRouteRefLoading(true);
    try {
      await initialize();
      const routeQuery = await api.getRouteQueryAPI();
      const count = await routeQuery.countRouteReferencesToLocations([nodeId]);
      setRouteRefCount(count);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRouteRefError(message);
    } finally {
      setRouteRefLoading(false);
    }
  };

  const confirmRemoveFile = async () => {
    if (pendingRemoveIndex == null) return;
    const nextSources = ideGsmSources.filter((_, idx) => idx !== pendingRemoveIndex);
    const primary = nextSources[nextSources.length - 1];
    if (api && nodeId) {
      try {
        await initialize();
        const locationMutation = await api.getLocationMutationAPI();
        await locationMutation.clearLocationArtifacts(nodeId);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setRouteRefError(message);
      }
    }
    onUpdate({
      ideGsmSources: nextSources.length > 0 ? nextSources : undefined,
      ideGsmFileName: primary?.fileName,
      ideGsmSourceUrl: primary?.sourceUrl,
      selectedArrayByCountries: {},
      ideGsmSelectionHash: undefined,
      processingStatus: undefined,
      processedAt: undefined,
      lastProcessedAt: undefined,
    });
    setRemoveDialogOpen(false);
    setPendingRemoveIndex(null);
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
          <IdeGsmImportPanel
            files={ideGsmSources}
            labels={ideGsmLabels}
            defaultDownloadUrl={draft.ideGsmSourceUrl}
            disabled={Boolean(disabled)}
            onAddFile={(payload) => {
              const nextSources = [...ideGsmSources, payload];
              const primary = nextSources[nextSources.length - 1];
              onUpdate({
                ideGsmSources: nextSources,
                ideGsmFileName: primary?.fileName,
                ideGsmSourceUrl: primary?.sourceUrl,
                selectedArrayByCountries: {},
                ideGsmSelectionHash: undefined,
              });
            }}
            onRemoveFile={(index) => {
              void requestRemoveFile(index);
            }}
          />
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
            ideGsmSources: nextSource === 'ide-gsm' ? draft.ideGsmSources : undefined,
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
        open={removeDialogOpen}
        onClose={() => setRemoveDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {t('dataSource.ideGsm.removeConfirmTitle', 'Remove IDE-GSM file?')}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Typography variant="body2">
            {t(
              'dataSource.ideGsm.removeConfirmMessage',
              'Removing this file will discard all locations imported from it.',
            )}
          </Typography>
          {routeRefLoading ? (
            <Typography variant="body2" color="text.secondary">
              {t('dataSource.ideGsm.routeRefLoading', 'Checking route references...')}
            </Typography>
          ) : routeRefError ? (
            <Typography variant="body2" color="error">
              {t('dataSource.ideGsm.routeRefError', 'Failed to check route references.')} {routeRefError}
            </Typography>
          ) : routeRefCount != null ? (
            <Typography variant="body2" color={routeRefCount > 0 ? 'error' : 'text.secondary'}>
              {t(
                'dataSource.ideGsm.routeRefCount',
                'Routes referencing this location node: {count}',
              ).replace('{count}', String(routeRefCount))}
            </Typography>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRemoveDialogOpen(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button onClick={confirmRemoveFile} color="error" variant="contained">
            {t('dataSource.ideGsm.removeConfirmAction', 'Remove')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
