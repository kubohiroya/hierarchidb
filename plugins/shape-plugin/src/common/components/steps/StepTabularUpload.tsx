import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Typography } from '@mui/material';
import type { StepComponentProps } from '@hierarchidb/plugin-base';
import { TabularProvider, TabularFileUploadStep } from '@hierarchidb/ui-tabular-extract';
import type { TabularTableMetadata } from '@hierarchidb/tabular-store';
import { createShapeTabularApi } from '../../../services/tabular/createShapeTabularApi.js';
import { SHAPE_PLUGIN_ID } from '../../shared/constants.js';
import type { ShapeWorkingCopy, TabularFileSummary } from '../../shared/types.js';

type ShapeDialogStepProps = StepComponentProps<Partial<ShapeWorkingCopy>>;

export function StepTabularUpload({
  data: workingCopy,
  onChange,
  setValid,
  setError,
  disabled,
}: ShapeDialogStepProps): JSX.Element {
  //const workingCopy = (data ?? {}) as Partial<ShapeWorkingCopy>;
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
        ...workingCopy,
        tabularMetadataId: metadata.id,
        tabularMetadata: metadata,
        tabularFile: nextFile,
      });
      setLocalError(null);
      setError?.(null);
      setValid?.(true);
    },
    [onChange, setError, setValid, workingCopy],
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
    const hasMetadata = Boolean(workingCopy?.tabularMetadataId);
    if (hasMetadata) {
      setValid?.(true);
      setError?.(null);
    } else if (!localError) {
      setValid?.(false);
      setError?.('Upload a dataset before continuing.');
    }
  }, [localError, setError, setValid, workingCopy?.tabularMetadataId]);

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
        <TabularFileUploadStep
          pluginId={SHAPE_PLUGIN_ID}
          onFileUploaded={applyMetadata}
          onError={handleUploadError}
          disabled={disabled}
        />
      </TabularProvider>
      {!workingCopy?.tabularMetadataId && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Select a file to enable preview and filtering in the next step.
        </Typography>
      )}
    </Box>
  );
}
