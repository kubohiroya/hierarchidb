import { useCallback, useEffect, useMemo } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import type { StepComponentProps } from '@hierarchidb/plugin-base';
import { TabularProvider, TabularFilterStep, useTabularData } from '@hierarchidb/ui-tabular-extract';
import type { TabularFilterRule, TabularDataResult } from '@hierarchidb/ui-tabular-extract';
import { createShapeTabularApi } from '../../../services/tabular/createShapeTabularApi.js';
import { SHAPE_PLUGIN_ID } from '../../shared/constants.js';
import type { ShapeDraft } from '../../shared/types.js';

type ShapeDialogStepProps = StepComponentProps<Partial<ShapeDraft>>;

export function StepTabularFilter({
  data: draft,
  onChange,
  setValid,
  setError,
}: ShapeDialogStepProps): JSX.Element {
  const tabularApi = useMemo(() => createShapeTabularApi(), []);

  const { metadata, loading, error } = useTabularData({
    tableMetadataId: draft?.tabularMetadataId,
    pluginId: SHAPE_PLUGIN_ID,
    autoload: Boolean(draft?.tabularMetadataId),
  });

  useEffect(() => {
    if (draft?.tabularMetadataId) {
      setValid?.(true);
      setError?.(error ?? null);
    } else {
      setValid?.(false);
      setError?.('Upload a dataset before applying filters.');
    }
  }, [error, setError, setValid, draft?.tabularMetadataId]);

  const handleFiltersChanged = useCallback(
    (filters: TabularFilterRule[]) => {
      onChange({
        ...draft,
        tabularFilters: filters,
      });
    },
    [onChange, draft],
  );

  const handlePreviewData = useCallback(
    (preview: TabularDataResult) => {
      onChange({
        ...draft,
        tabularLastPreview: preview,
      });
    },
    [onChange, draft],
  );

  const content = (() => {
    if (!draft?.tabularMetadataId) {
      return (
        <Typography color="text.secondary">
          Upload a dataset in the previous step to configure filters.
        </Typography>
      );
    }
    if (loading) {
      return (
        <Box display="flex" alignItems="center" gap={1}>
          <CircularProgress size={18} />
          <Typography variant="body2" color="text.secondary">
            Loading table metadata...
          </Typography>
        </Box>
      );
    }
    if (error) {
      return (
        <Typography color="error">
          {error}
        </Typography>
      );
    }
    if (!metadata) {
      return (
        <Typography color="text.secondary">
          No table metadata found for the selected dataset.
        </Typography>
      );
    }
    return (
      <TabularFilterStep
        tableMetadata={metadata}
        pluginId={SHAPE_PLUGIN_ID}
        onFiltersChanged={handleFiltersChanged}
        onPreviewData={handlePreviewData}
      />
    );
  })();

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Preview &amp; Filter
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Inspect rows and define filters that downstream batch processing should respect.
      </Typography>
      <TabularProvider tabularApi={tabularApi}>{content}</TabularProvider>
    </Box>
  );
}
