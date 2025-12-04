import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FC } from 'react';
import { StepComponentProps } from '@hierarchidb/plugin-base';
import { TabularProvider, TabularFileUploadStep } from '@hierarchidb/ui-tabular-extract';
import type { TabularTableMetadata } from '@hierarchidb/tabular-store';
import { createSpreadsheetTabularApi } from '../../../services/spreadsheetTabularApiFactory.js';
import { SPREADSHEET_NODE_TYPE } from '../../../common/constants.js';
import type { SpreadSheetDataSourceConfig, SpreadsheetEntity } from '../../../common/types/SpreadsheetEntity.js';

const coerceDialogData = (value: unknown): SpreadsheetEntity =>
  (typeof value === 'object' && value !== null ? (value as SpreadsheetEntity) : {});

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

  const applyMetadata = useCallback(
    (tabularTableMetadata: TabularTableMetadata) => {
      const nextDataSource: SpreadSheetDataSourceConfig = {
        type: 'file',
        source: tabularTableMetadata.fileUrl ?? tabularTableMetadata.filename,
        filename: tabularTableMetadata.filename,
        sizeBytes: tabularTableMetadata.fileSizeBytes ?? 0,
        contentHash: tabularTableMetadata.contentHash,
      };
      onChange({
        ...dialogData,
        spreadsheetMetadataId: tabularTableMetadata.id,
        dataSource: nextDataSource,
        metadata: tabularTableMetadata,
        file: {
          name: tabularTableMetadata.filename,
          sizeBytes: tabularTableMetadata.fileSizeBytes ?? 0,
          lastModifiedAt: Date.now(),
        },
      });
      setLocalError(null);
      setValid(true);
      setError(null);
    },
    [dialogData, onChange, setError, setValid],
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

  return (
    <TabularProvider tabularApi={tabularApi}>
      <TabularFileUploadStep
        pluginId={SPREADSHEET_NODE_TYPE}
        onFileUploaded={applyMetadata}
        onError={handleUploadError}
        menuContainer={menuContainer}
      />
    </TabularProvider>
  );
};
