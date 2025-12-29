/**
 * Location Data Source Selection Step
 */

import type React from 'react';
import { useMemo } from 'react';
import { Alert, Box, Stack, Typography } from '@mui/material';
import {
  DataSourceSelectionStep,
  type DataSourceSelectionOption,
  type DataSourceSelectorProps,
} from '@hierarchidb/ui-datasource';
import { FileInputWithUrl } from '@hierarchidb/ui-file';
import { notify } from '@hierarchidb/components';
import type { LocationDataSource, LocationEntity, LocationType } from '../../../common/types/index.js';
import { useTranslation } from '../../../common/i18n/index.js';
import type { Timestamp } from '@hierarchidb/common-types';
import { parseIdeGsmCsv } from '@hierarchidb/location-store';
import { BASE_LOCATION_TYPES } from './locationTypes.js';

const ORDERED_DATA_SOURCES: LocationDataSource[] = [
  'openstreetmap',
  'overpass',
  'geonames',
  'wikidata',
  'ourairports',
  'openflights',
  'world-port-index',
  'natural-earth',
  'ide-gsm',
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

const SOURCE_TYPES: Record<LocationDataSource, LocationType[]> = {
  openstreetmap: ['area_centroid', 'airport', 'port', 'railway_station', 'interchange'],
  overpass: ['area_centroid', 'airport', 'port', 'railway_station', 'interchange'],
  geonames: ['area_centroid', 'airport', 'port'],
  wikidata: ['area_centroid', 'airport', 'port', 'railway_station', 'interchange'],
  ourairports: ['airport'],
  openflights: ['airport'],
  'world-port-index': ['port'],
  'natural-earth': ['area_centroid', 'airport', 'port'],
  'ide-gsm': ['area_centroid', 'airport', 'port', 'railway_station', 'interchange'],
  custom: ['area_centroid', 'airport', 'port', 'railway_station', 'interchange'],
  manual: ['area_centroid', 'airport', 'port', 'railway_station', 'interchange'],
};

const DISABLED_SOURCES: LocationDataSource[] = ORDERED_DATA_SOURCES.filter(
  (sourceId) => sourceId !== 'ide-gsm',
);

export const LocationDataSourceStep: React.FC<LocationDataSourceStepProps> = ({
  draft,
  onUpdate,
  licenseRequired = true,
  disabled,
}) => {
  const { t } = useTranslation();

  const value = useMemo<LocationDataSource>(
    () => (draft.dataSource as LocationDataSource) ?? 'openstreetmap',
    [draft.dataSource]
  );

  const options = useMemo<DataSourceSelectionOption[]>(
    () =>
      ORDERED_DATA_SOURCES.map((sourceId) => {
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

  const renderOption: DataSourceSelectorProps['renderOption'] = (option) => {
    const supported = SOURCE_TYPES[option.id as LocationDataSource] ?? SOURCE_TYPES.openstreetmap;
    const icons = supported
      .map((type) => TYPE_ICONS[type] ?? '')
      .filter(Boolean)
      .join(' ');
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
      </Stack>
    );
  };

  return (
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
        onUpdate({
          dataSource: nextSource,
          licenseAgreement: next.licenseAgreement,
          licenseAgreedAt: next.licenseAgreedAt,
          ideGsmFileName: nextSource === 'ide-gsm' ? draft.ideGsmFileName : undefined,
          ideGsmSourceUrl: nextSource === 'ide-gsm' ? draft.ideGsmSourceUrl : undefined,
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
      renderDetails={(selected) => {
        if (DISABLED_SOURCES.includes(selected.id as LocationDataSource)) {
          return (
            <Alert severity="warning">
              {t(
                'dataSource.unsupported',
                'This data source is not supported yet. Please select another source.',
              )}
            </Alert>
          );
        }
        if (selected.id !== 'ide-gsm') return null;
        return (
          <FileInputWithUrl
            accept=".csv,.xlsx,.xls"
            buttonLabel={t('dataSource.ideGsm.buttonLabel', 'Select IDE-GSM file')}
            instructions={t(
              'dataSource.ideGsm.instructions',
              'Provide an IDE-GSM CSV file via upload or URL.',
            )}
            defaultDownloadUrl={draft.ideGsmSourceUrl}
            onFileSelect={async (file, downloadUrl) => {
              const updates: Partial<LocationEntity> = {
                ideGsmFileName: file.name,
                ideGsmSourceUrl: downloadUrl ?? undefined,
              };
              try {
                const csvText = await file.text();
                const parsed = await parseIdeGsmCsv(csvText);
                if (!parsed.points.length) {
                  notify.warning(t('dataSource.ideGsm.empty', 'No valid IDE-GSM rows found.'));
                  updates.selectedArrayByCountries = {};
                } else {
                  const typeIndex = new Map(
                    BASE_LOCATION_TYPES.map((typeDef, index) => [typeDef.id, index]),
                  );
                  const selectionMap: Record<string, boolean[]> = {};
                  parsed.points.forEach((point) => {
                    const countryCode = point.countryCode?.toUpperCase();
                    if (!countryCode) return;
                    const idx = typeIndex.get(point.kind as LocationType);
                    if (idx == null) return;
                    if (!selectionMap[countryCode]) {
                      selectionMap[countryCode] = Array(BASE_LOCATION_TYPES.length).fill(false);
                    }
                    selectionMap[countryCode][idx] = true;
                  });
                  updates.selectedArrayByCountries = selectionMap;
                }
              } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                notify.error(
                  `${t('dataSource.ideGsm.parseError', 'Failed to parse IDE-GSM CSV.')} ${message}`,
                );
              }
              onUpdate(updates);
            }}
          />
        );
      }}
    />
  );
};
