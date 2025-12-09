import type { FC } from 'react';
import { StepComponentProps } from '@hierarchidb/plugin-base';
import { TabularProvider, TabularDataFilter } from '@hierarchidb/ui-tabular-extract';
import type { SpreadsheetEntity } from '../../../common/types/SpreadsheetEntity.js';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useTranslation } from '@hierarchidb/ui-i18n';
import { useTabularDataFilter } from '../../hooks/useTabularDataFilter.js';

export const TabularDataFilterStep: FC<StepComponentProps<SpreadsheetEntity>> = ({
  data,
  onChange,
  setValid,
  setError,
  dialogRef,
}) => {
  const { t } = useTranslation('spreadsheet-plugin');
  const {
    pluginId,
    tabularApi,
    menuContainer,
    initialFilters,
    tableMetadata,
    loading,
    error,
    shouldUploadFirst,
    syncFilters,
    handlePreviewData,
  } = useTabularDataFilter({ data, onChange, setValid, setError, dialogRef });

  if (shouldUploadFirst) {
    return (
      <Typography color="text.secondary">
        {t('filtering.instructions.uploadFirst', 'Upload a dataset in Step 1 to configure filters.')}
      </Typography>
    );
  }
  if (loading) {
    return (
      <Box display="flex" alignItems="center" gap={1}>
        <CircularProgress size={18} />
        <Typography variant="body2" color="text.secondary">
          {t('filtering.loading', 'Loading table metadata...')}
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
  if (!tableMetadata) {
    return (
      <Typography color="text.secondary">
        {t('filtering.noMetadata', 'No table metadata found for the selected dataset.')}
      </Typography>
    );
  }

  return (
    <TabularProvider tabularApi={tabularApi}>
      <TabularDataFilter
        tableMetadata={tableMetadata}
        pluginId={pluginId}
        onPreviewData={handlePreviewData}
        initialFilters={initialFilters}
        onSyncFilters={syncFilters}
        menuContainer={menuContainer}
      />
    </TabularProvider>
  );
};
