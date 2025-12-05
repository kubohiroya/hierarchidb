import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FC } from 'react';
import { StepComponentProps } from '@hierarchidb/plugin-base';
import { TabularProvider, TabularFileImportStep, type TabularProcessingConfig, type TabularFileImportStepProps } from '@hierarchidb/ui-tabular-extract';
import type { TabularTableMetadata } from '@hierarchidb/tabular-store';
import { createSpreadsheetTabularApi } from '../../../services/spreadsheetTabularApiFactory.js';
import { SPREADSHEET_NODE_TYPE } from '../../../common/constants.js';
import type { SpreadSheetDataSourceConfig, SpreadsheetEntity } from '../../../common/types/SpreadsheetEntity.js';

const coerceDialogData = (value: unknown): SpreadsheetEntity =>
  (typeof value === 'object' && value !== null ? (value as SpreadsheetEntity) : {});

type ExtendedImportProps = TabularFileImportStepProps & {
  initialProcessingConfig?: TabularProcessingConfig;
  onProcessingConfigChange?: (config: TabularProcessingConfig) => void;
};

const ImportStep = TabularFileImportStep as unknown as React.FC<ExtendedImportProps>;

export const DataSourceStep: FC<StepComponentProps<SpreadsheetEntity>> = ({
  data,
  onChange,
  setValid,
  setError,
  dialogRef,
}) => {
  const dialogData = useMemo<SpreadsheetEntity>(() => coerceDialogData(data), [data]);
  const [localError, setLocalError] = useState<string | null>(null);
  const tabularApi = useMemo(() => createSpreadsheetTabularApi(SPREADSHEET_NODE_TYPE), []);
  const derivedImportMethod: 'file' | 'url' =
    dialogData.dataSource?.type === 'url' || dialogData.dataSource?.source?.startsWith('http') ? 'url' : 'file';
  const derivedUrl = dialogData.dataSource?.source ?? '';
  const derivedProcessing = dialogData.tabularProcessingConfig;

  const [importMethod, setImportMethod] = useState<'file' | 'url'>(derivedImportMethod);
  const [downloadUrl, setDownloadUrl] = useState(derivedUrl);
  const [lastSuccessfulUrl, setLastSuccessfulUrl] = useState<string | null>(() => {
    const source = dialogData.dataSource?.source ?? null;
    const hasMetadata = Boolean(dialogData.spreadsheetMetadataId && source);
    const sourceLooksLikeUrl = source?.startsWith('http');
    const persistedAsUrl = dialogData.dataSource?.type === 'url' || derivedImportMethod === 'url';
    return hasMetadata && (persistedAsUrl || sourceLooksLikeUrl) ? source : null;
  });
  const [processingConfig, setProcessingConfig] = useState<TabularProcessingConfig | undefined>(derivedProcessing);
  const importSucceeded = Boolean(lastSuccessfulUrl && lastSuccessfulUrl === downloadUrl);

  const applyMetadata = useCallback(
    (tabularTableMetadata: TabularTableMetadata) => {
      const nextDataSource: SpreadSheetDataSourceConfig = {
        type: importMethod,
        source: importMethod === 'url' ? downloadUrl : (tabularTableMetadata.fileUrl ?? tabularTableMetadata.filename),
        filename: tabularTableMetadata.filename,
        sizeBytes: tabularTableMetadata.fileSizeBytes ?? 0,
        contentHash: tabularTableMetadata.contentHash,
      };
      onChange({
        ...dialogData,
        spreadsheetMetadataId: tabularTableMetadata.id,
        dataSource: nextDataSource,
        tabularTableMetadata: tabularTableMetadata,
        file: {
          name: tabularTableMetadata.filename,
          sizeBytes: tabularTableMetadata.fileSizeBytes ?? 0,
          lastModifiedAt: Date.now(),
        },
        tabularProcessingConfig: processingConfig,
      });
      if (importMethod === 'url') {
        setLastSuccessfulUrl(downloadUrl);
      }
      setLocalError(null);
      setValid(true);
      setError(null);
    },
    [dialogData, onChange, setError, setValid, importMethod, downloadUrl, processingConfig],
  );

  const handleUploadError = useCallback(
    (message: string) => {
      setLocalError(message);
      setValid(false);
      setError(message);
    },
    [setError, setValid],
  );

  useEffect(() => {
    const hasMetadata = Boolean(dialogData.spreadsheetMetadataId);
    setValid(hasMetadata);
    if (!hasMetadata && !localError) {
      setError('Upload or select a dataset before continuing.');
    } else if (hasMetadata) {
      setError(null);
    }
  }, [dialogData.spreadsheetMetadataId, localError, setError, setValid]);

  const menuContainer =
    dialogRef?.current instanceof HTMLElement
      ? dialogRef.current.closest('.MuiModal-root') ?? dialogRef.current
      : null;

  // backfill initial defaults into entity if missing
  useEffect(() => {
    const needsBackfill = dialogData.tabularProcessingConfig === undefined;
    if (!needsBackfill) return;
    onChange({
      ...dialogData,
      tabularProcessingConfig: processingConfig ?? {
        delimiter: ',',
        encoding: 'utf-8',
        hasHeader: true,
        quoteChar: '"',
        escapeChar: '\\',
        skipEmptyLines: true,
      },
    });
  }, [dialogData, onChange, processingConfig]);

  return (
    <TabularProvider tabularApi={tabularApi}>
      <ImportStep
        pluginId={SPREADSHEET_NODE_TYPE}
        onFileImported={applyMetadata}
        onError={handleUploadError}
        menuContainer={menuContainer}
        initialImportMethod={derivedImportMethod}
        initialUrl={downloadUrl}
        initialProcessingConfig={processingConfig}
        onImportMethodChange={(method: 'file' | 'url') => {
          setImportMethod(method);
          onChange({
            ...dialogData,
            dataSource: {
              ...(dialogData.dataSource ?? { type: method }),
              type: method,
            },
          });
        }}
        onUrlChange={(url: string) => {
          setDownloadUrl(url);
          if (lastSuccessfulUrl && url !== lastSuccessfulUrl) {
            setLastSuccessfulUrl(null);
          }
          onChange({
            ...dialogData,
            dataSource: {
              ...(dialogData.dataSource ?? { type: 'url' }),
              type: 'url',
              source: url,
            },
          });
        }}
        onProcessingConfigChange={(cfg: TabularProcessingConfig) => {
          setProcessingConfig(cfg);
          onChange({ ...dialogData, tabularProcessingConfig: cfg });
        }}
        importSucceeded={importSucceeded}
      />
    </TabularProvider>
  );
};
