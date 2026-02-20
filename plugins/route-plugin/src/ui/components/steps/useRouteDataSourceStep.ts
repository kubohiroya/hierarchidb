import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type DataSourceSelectionOption,
  type IdeGsmImportPayload,
} from '@hierarchidb/ui-datasource';
import { useTranslation } from '~/common/i18n/index';
import type { RouteEntity } from '@hierarchidb/route-api';
import { ROUTE_DATA_SOURCES } from '~/common/datasource/configs';
import { createRouteTabularApi } from '~/common/tabular/createRouteTabularApi';

export interface RouteDataSourceStepHookParams {
  draft: Partial<RouteEntity>;
  onUpdate: (updates: Partial<RouteEntity>) => void;
  onValidationChange: (isValid: boolean) => void;
}

const DATA_SOURCE_OPTIONS = [{ id: 'ide-gsm', key: 'ide-gsm' }] as const;

type DataSourceKey = typeof DATA_SOURCE_OPTIONS[number]['id'];

const ensureTabularXlsx = async (): Promise<void> => {
  await import('@hierarchidb/tabular-source-xlsx');
};

const decodeDataUrlToFile = (dataUrl: string, filename: string): File | null => {
  if (!dataUrl.startsWith('data:')) return null;
  const [header, payload] = dataUrl.split(',');
  if (!header || payload === undefined) return null;
  const match = /^data:(.*?)(;base64)?$/.exec(header);
  const mime = match?.[1] || 'application/octet-stream';
  const isBase64 = Boolean(match?.[2]);
  try {
    const data = isBase64 ? atob(payload) : decodeURIComponent(payload);
    const bytes = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i += 1) {
      bytes[i] = data.charCodeAt(i);
    }
    return new File([bytes], filename, { type: mime });
  } catch {
    return null;
  }
};

export const useRouteDataSourceStep = ({
  draft: draftProp,
  onUpdate,
  onValidationChange,
}: RouteDataSourceStepHookParams) => {
  const { t } = useTranslation();
  const tabularApi = useMemo(() => createRouteTabularApi(), []);
  const [importInProgress, setImportInProgress] = useState(false);
  const draft = draftProp;
  const resolvedSource = (draft.dataSourceName as DataSourceKey | undefined) ?? 'ide-gsm';
  const dataSourceMap = useMemo(
    () => new Map(ROUTE_DATA_SOURCES.map((source) => [source.name, source])),
    [],
  );
  const ideGsmLabels = useMemo(
    () => ({
      importButton: t('dataSource.ideGsm.importButton', 'Import'),
      noFiles: t('dataSource.ideGsm.noFiles', 'No files imported.'),
      importLocal: t('dataSource.ideGsm.importLocal', 'Import Local Files'),
      importRemote: t('dataSource.ideGsm.importRemote', 'Import Remote Files'),
      fileFallback: t('dataSource.ideGsm.fileFallback', 'Imported file'),
      removeFile: t('dataSource.ideGsm.removeFile', 'Remove imported file'),
      buttonLabel: t('dataSource.ideGsm.buttonLabel', 'Select IDE-GSM file'),
      instructions: t(
        'dataSource.ideGsm.instructions',
        'Provide an IDE-GSM schema file (location/resource) via upload or URL.',
      ),
    }),
    [t],
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
    const isValid = resolvedSource === 'ide-gsm'
      ? Boolean(draft.tabularSourceId)
      : Boolean(resolvedSource);
    onValidationChange(isValid);
  }, [draft.tabularSourceId, onValidationChange, resolvedSource]);

  useEffect(() => {
    if (!draft.dataSourceName) {
      emitUpdate({ dataSourceName: resolvedSource });
    }
  }, [draft.dataSourceName, emitUpdate, resolvedSource]);

  const handleIdeGsmImport = useCallback(async (payload: IdeGsmImportPayload) => {
    if (importInProgress) return;
    setImportInProgress(true);
    try {
      await ensureTabularXlsx();
      const metadata = await tabularApi.uploadTabularFile(payload.file, {});
      emitUpdate({
        ideGsmFileName: metadata.filename ?? payload.file.name,
        ideGsmFileSizeBytes: metadata.fileSizeBytes ?? payload.file.size,
        tabularSourceId: metadata.id,
        ideGsmSourceUrl: undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[RouteDataSourceStep] failed to import IDE-GSM file', message);
    } finally {
      setImportInProgress(false);
    }
  }, [emitUpdate, importInProgress, tabularApi]);

  const handleIdeGsmClear = useCallback(async () => {
    if (!draft.tabularSourceId) {
      emitUpdate({
        ideGsmFileName: undefined,
        ideGsmFileSizeBytes: undefined,
        tabularSourceId: undefined,
        ideGsmSourceUrl: undefined,
      });
      return;
    }
    try {
      await tabularApi.removeTableReference(draft.tabularSourceId, 'route');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[RouteDataSourceStep] failed to remove IDE-GSM table reference', message);
    } finally {
      emitUpdate({
        ideGsmFileName: undefined,
        ideGsmFileSizeBytes: undefined,
        tabularSourceId: undefined,
        ideGsmSourceUrl: undefined,
      });
    }
  }, [draft.tabularSourceId, emitUpdate, tabularApi]);

  useEffect(() => {
    if (!draft.ideGsmSourceUrl) return;
    if (draft.tabularSourceId) return;
    if (importInProgress) return;
    let cancelled = false;
    const migrate = async () => {
      setImportInProgress(true);
      try {
        await ensureTabularXlsx();
        const fallbackName = draft.ideGsmFileName ?? t('dataSource.ideGsm.fileFallback', 'Imported file');
        const dataUrlFile = decodeDataUrlToFile(draft.ideGsmSourceUrl ?? '', fallbackName);
        const metadata = dataUrlFile
          ? await tabularApi.uploadTabularFile(dataUrlFile, {})
          : await tabularApi.downloadTabularFromUrl(draft.ideGsmSourceUrl ?? '', {});
        if (cancelled || !metadata) return;
        emitUpdate({
          ideGsmFileName: metadata.filename ?? fallbackName,
          ideGsmFileSizeBytes: metadata.fileSizeBytes ?? dataUrlFile?.size,
          tabularSourceId: metadata.id,
          ideGsmSourceUrl: undefined,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[RouteDataSourceStep] failed to migrate legacy IDE-GSM source', message);
      } finally {
        if (!cancelled) {
          setImportInProgress(false);
        }
      }
    };
    void migrate();
    return () => {
      cancelled = true;
    };
  }, [draft.ideGsmFileName, draft.ideGsmSourceUrl, draft.tabularSourceId, emitUpdate, importInProgress, t, tabularApi]);

  const handleSelectionChange = useCallback(
    (next: { dataSourceId?: string; licenseAgreement?: boolean; licenseAgreedAt?: number }) => {
      const nextSource = (next.dataSourceId as DataSourceKey | undefined) ?? resolvedSource;
      emitUpdate({
        dataSourceName: nextSource,
        licenseAgreement: next.licenseAgreement,
        licenseAgreedAt: next.licenseAgreedAt,
        ideGsmFileName: nextSource === 'ide-gsm' ? draft.ideGsmFileName : undefined,
        ideGsmFileSizeBytes: nextSource === 'ide-gsm' ? draft.ideGsmFileSizeBytes : undefined,
        tabularSourceId: nextSource === 'ide-gsm' ? draft.tabularSourceId : undefined,
      });
    },
    [draft.ideGsmFileName, draft.ideGsmFileSizeBytes, draft.tabularSourceId, emitUpdate, resolvedSource],
  );

  return {
    t,
    draft,
    resolvedSource,
    options,
    ideGsmLabels,
    importInProgress,
    handleSelectionChange,
    handleIdeGsmImport,
    handleIdeGsmClear,
  };
};
