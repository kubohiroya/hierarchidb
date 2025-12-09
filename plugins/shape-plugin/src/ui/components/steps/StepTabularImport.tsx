import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Typography } from '@mui/material';
import type { StepComponentProps } from '@hierarchidb/plugin-base';
import { TabularProvider, TabularDataImport } from '@hierarchidb/ui-tabular-extract';
import type { TabularTableMetadata } from '@hierarchidb/tabular-store';
import { createShapeTabularApi } from '../../../services/tabular/createShapeTabularApi.js';
import { SHAPE_PLUGIN_ID } from '../../../common/shared/constants.js';
import type { ShapeEntity, TabularFileSummary } from '../../../common/shared/types.js';

type ShapeDialogStepProps = StepComponentProps<Partial<ShapeEntity>>;

export function StepTabularImport({
  data,
  onChange,
  setValid,
  setError,
  disabled,
  dialogRef,
}: ShapeDialogStepProps): JSX.Element {
  const draft = useMemo(()=>(data ?? {}) as Partial<ShapeEntity>, [data]);
  const tabularApi = useMemo(() => createShapeTabularApi(), []);
  const [localError, setLocalError] = useState<string | null>(null);

  const applyMetadata = useCallback(
    (metadata: TabularTableMetadata) => {
      const inferredType = metadata.filename?.toLowerCase().endsWith('.tsv')
        ? 'text/tab-separated-values'
        : metadata.filename?.toLowerCase().endsWith('.json')
          ? 'application/json'
          : 'text/csv';
      const nextFile: TabularFileSummary = {
        name: metadata.filename,
        sizeBytes: metadata.fileSizeBytes ?? 0,
        type: inferredType,
        lastModifiedAt: Date.now(),
      };
      onChange({
        ...draft,
        tabularMetadataId: metadata.id,
        tabularMetadata: metadata,
        tabularFile: nextFile,
      });
      setLocalError(null);
      setError?.(null);
      setValid?.(true);
    },
    [onChange, setError, setValid, draft],
  );

  const handleUploadError = useCallback(
    (message: string) => {
      setLocalError(message);
      setValid?.(false);
      setError?.(message);
    },
    [setError, setValid],
  );

  useEffect(() => {
    const hasMetadata = Boolean(draft?.tabularMetadataId);
    if (hasMetadata) {
      setValid?.(true);
      setError?.(null);
    } else if (!localError) {
      setValid?.(false);
      setError?.('Upload a dataset before continuing.');
    }
  }, [localError, setError, setValid, draft?.tabularMetadataId]);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Upload Dataset
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Import Tabular/TSV files that describe the shapes you plan to process. The data will be stored
        in the shared tabular store so other plugins can reuse it.
      </Typography>
      <TabularProvider tabularApi={tabularApi}>
        <TabularDataImport
          pluginId={SHAPE_PLUGIN_ID}
          onFileImported={applyMetadata}
          onError={handleUploadError}
          disabled={disabled}
          menuContainer={
            dialogRef?.current instanceof HTMLElement
              ? dialogRef.current.closest('.MuiModal-root') ?? dialogRef.current
              : null
          }
        />
      </TabularProvider>
      {!draft?.tabularMetadataId && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Select a file to enable preview and filtering in the next step.
        </Typography>
      )}
    </Box>
  );
}
