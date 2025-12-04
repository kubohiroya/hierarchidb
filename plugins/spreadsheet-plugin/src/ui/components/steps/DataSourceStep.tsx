import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FC } from 'react';
import { StepComponentProps } from '@hierarchidb/plugin-base';
import { TabularProvider, TabularFileUploadStep, type TabularProcessingConfig, type TabularFileUploadStepProps } from '@hierarchidb/ui-tabular-extract';
import type { TabularTableMetadata } from '@hierarchidb/tabular-store';
import { createSpreadsheetTabularApi } from '../../../services/spreadsheetTabularApiFactory.js';
import { SPREADSHEET_NODE_TYPE } from '../../../common/constants.js';
import type { SpreadSheetDataSourceConfig, SpreadsheetEntity } from '../../../common/types/SpreadsheetEntity.js';

const coerceDialogData = (value: unknown): SpreadsheetEntity =>
  (typeof value === 'object' && value !== null ? (value as SpreadsheetEntity) : {});

type ExtendedUploadProps = TabularFileUploadStepProps & {
  initialUploadMethod?: 'file' | 'url';
  initialProcessingConfig?: TabularProcessingConfig;
  onProcessingConfigChange?: (config: TabularProcessingConfig) => void;
  onUploadMethodChange?: (method: 'file' | 'url') => void;
};

const UploadStep = TabularFileUploadStep as unknown as React.FC<ExtendedUploadProps>;

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
  const derivedUploadMethod: 'file' | 'url' =
    dialogData.dataSource?.type === 'url' ? 'url' : 'file';
  const derivedUrl = dialogData.dataSource?.source ?? '';
  const derivedProcessing = dialogData.tabularProcessingConfig;

  const [uploadMethod, setUploadMethod] = useState<'file' | 'url'>(derivedUploadMethod);
  const [downloadUrl, setDownloadUrl] = useState(derivedUrl);
  const [processingConfig, setProcessingConfig] = useState<TabularProcessingConfig | undefined>(derivedProcessing);

  const applyMetadata = useCallback(
    (tabularTableMetadata: TabularTableMetadata) => {
      const nextDataSource: SpreadSheetDataSourceConfig = {
        type: 'file',
        source: uploadMethod === 'url' ? downloadUrl : (tabularTableMetadata.fileUrl ?? tabularTableMetadata.filename),
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
      setLocalError(null);
      setValid(true);
      setError(null);
    },
    [dialogData, onChange, setError, setValid, uploadMethod, downloadUrl, processingConfig],
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
  }, [dialogData, downloadUrl, onChange, processingConfig, uploadMethod]);

  return (
    <TabularProvider tabularApi={tabularApi}>
      <UploadStep
        pluginId={SPREADSHEET_NODE_TYPE}
        onFileUploaded={applyMetadata}
        onError={handleUploadError}
        menuContainer={menuContainer}
        initialUploadMethod={uploadMethod}
        initialUrl={downloadUrl}
        initialProcessingConfig={processingConfig}
        onUploadMethodChange={(method: 'file' | 'url') => {
          setUploadMethod(method);
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
      />
    </TabularProvider>
  );
};
