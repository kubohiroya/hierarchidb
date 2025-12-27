/**
 * @file RouteDataSourceStep.tsx
 * @description Step 2: select data source for route generation.
 */

import { useCallback, useEffect, useMemo } from 'react';
import { Box } from '@mui/material';
import { FileInputWithUrl } from '@hierarchidb/ui-file';
import { DataSourceSelectionStep, type DataSourceSelectionOption } from '@hierarchidb/ui-datasource';
import { useTranslation } from '../../../common/i18n/index.js';
import type { RouteEntity, RouteUpdaterPayload } from '../../../common/entities/RouteEntity.js';
import { getRouteUpdaterPayload } from '../../../common/utils/draft.js';
import { ROUTE_DATA_SOURCES } from '../../../common/datasource/configs.js';

export interface RouteDataSourceStepProps {
  draft: RouteUpdaterPayload;
  onUpdate: (updates: Partial<RouteEntity>) => void;
  onValidationChange: (isValid: boolean) => void;
  disabled?: boolean;
}

const DATA_SOURCE_OPTIONS = [
  { id: 'openstreetmap', key: 'openstreetmap' },
  { id: 'searoute', key: 'searoute' },
  { id: 'ide-gsm', key: 'ide-gsm' },
  { id: 'custom', key: 'custom' },
] as const;

type DataSourceKey = typeof DATA_SOURCE_OPTIONS[number]['id'];

export const RouteDataSourceStep: React.FC<RouteDataSourceStepProps> = ({
  draft: draftProp,
  onUpdate,
  onValidationChange,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const draft = useMemo(() => getRouteUpdaterPayload(draftProp), [draftProp]);
  const resolvedSource = (draft.dataSourceName as DataSourceKey | undefined) ?? 'openstreetmap';
  const dataSourceMap = useMemo(
    () => new Map(ROUTE_DATA_SOURCES.map((source) => [source.name, source])),
    [],
  );
  const options = useMemo<DataSourceSelectionOption[]>(
    () =>
      DATA_SOURCE_OPTIONS.map(({ id, key }) => {
        const source = dataSourceMap.get(id);
        return {
          id,
          name: t(`dataSource.options.${key}`, id),
          description: source?.description ?? '',
          licenseName: source?.license ?? 'License',
          licenseUrl: source?.licenseUrl || undefined,
          attribution: source?.attribution || undefined,
          disabled: id !== 'ide-gsm',
        };
      }),
    [dataSourceMap, t],
  );

  const emitUpdate = useCallback(
    (updates: Partial<RouteEntity>) => {
      onUpdate({
        ...updates,
      });
    },
    [onUpdate],
  );

  useEffect(() => {
    onValidationChange(Boolean(resolvedSource));
  }, [onValidationChange, resolvedSource]);

  useEffect(() => {
    if (!draft.dataSourceName) {
      emitUpdate({ dataSourceName: resolvedSource });
    }
  }, [draft.dataSourceName, emitUpdate, resolvedSource]);

  return (
    <Box sx={{ p: 3, maxWidth: 720, margin: '0 auto' }}>
      <DataSourceSelectionStep<number>
        title={t('dataSource.title', 'Data Source')}
        options={options}
        state={{
          dataSourceId: resolvedSource,
          licenseAgreement: Boolean(draft.licenseAgreement),
          licenseAgreedAt: draft.licenseAgreedAt,
        }}
        onChange={(next) => {
          const nextSource = (next.dataSourceId as DataSourceKey | undefined) ?? resolvedSource;
          emitUpdate({
            dataSourceName: nextSource,
            licenseAgreement: next.licenseAgreement,
            licenseAgreedAt: next.licenseAgreedAt,
            ideGsmFileName: nextSource === 'ide-gsm' ? draft.ideGsmFileName : undefined,
            ideGsmSourceUrl: nextSource === 'ide-gsm' ? draft.ideGsmSourceUrl : undefined,
          });
        }}
        disabled={disabled}
        description={t(
          'dataSource.description',
          'Choose the primary dataset or service that provides route geometry.',
        )}
        createAgreedAt={() => Date.now()}
        selectionTitle={t('dataSource.selectionTitle', 'Data Source')}
        detailsTitle={t('dataSource.detailsTitle', 'Data Source Details')}
        licenseRequiredText={t(
          'dataSource.licenseRequired',
          'License agreement is required to proceed.',
        )}
        renderDetails={(selected) => {
          if (selected.id !== 'ide-gsm') return null;
          return (
            <FileInputWithUrl
              accept=".csv,.xlsx,.xls"
              buttonLabel={t('dataSource.ideGsm.buttonLabel', 'Select IDE-GSM file')}
              instructions={t(
                'dataSource.ideGsm.instructions',
                'Provide an IDE-GSM schema file (location/resource) via upload or URL.',
              )}
              defaultDownloadUrl={draft.ideGsmSourceUrl}
              onFileSelect={(file, downloadUrl) => {
                emitUpdate({
                  ideGsmFileName: file.name,
                  ideGsmSourceUrl: downloadUrl ?? undefined,
                });
              }}
            />
          );
        }}
      />
    </Box>
  );
};
