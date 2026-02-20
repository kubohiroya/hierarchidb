import {
  TabularDataFilter,
  TabularProvider,
  type TabularDataFilterProps,
  type TabularDataResult,
  type TabularFilterRule,
} from '@hierarchidb/ui-tabular';
import type { SpreadsheetDraft } from '~/common/types/SpreadsheetEntity';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useTabularDataFilterStep } from '~/ui/hooks/useTabularDataFilterStep';
import { TabularFilterSections } from '~/ui/components/TabularFilterSections';
import type { PluginStepProps } from '@hierarchidb/plugin-base';
import type { useTabularKeyValueState } from '~/ui/hooks/useTabularKeyValueState';
import type { useTabularDataFilter } from '~/ui/hooks/useTabularDataFilter';
import {
  useTabularDataFilterStepView,
  type TabularDataFilterStepProps,
} from './useTabularDataFilterStepView.js';

type FilterInnerProps<T extends SpreadsheetDraft> = ReturnType<typeof useTabularDataFilter<T>> & {
  setValid: PluginStepProps<T>['setValid'];
  setError: PluginStepProps<T>['setError'];
  renderSections?: TabularDataFilterProps['renderSections'];
  onFiltersChanged?: (filters: TabularFilterRule[]) => void;
  onPreviewReady?: (preview: TabularDataResult) => void;
  keyValueState: ReturnType<typeof useTabularKeyValueState<T>>;
  keyValueValid: boolean;
  dialogRef?: PluginStepProps<T>['dialogRef'];
  translationNamespace?: string;
  filtersFromAtom: TabularFilterRule[];
  showPreview?: boolean;
};

const TabularDataFilterInner = <T extends SpreadsheetDraft>({
  pluginId,
  keyValueState,
  keyValueValid,
  translationNamespace,
  filtersFromAtom,
  shouldUploadFirst,
  initialFilters,
  syncFilters,
  menuContainer,
  onFiltersChanged,
  onPreviewReady,
  renderSections,
  dialogData,
  setValid,
  setError,
  dialogRef,
  showPreview = true,
}: FilterInnerProps<T>) => {
  const {
    t,
    tableMetadata,
    loading,
    error,
    stableInitialFilters,
    renderSectionsProps,
    stablePreviewHandler,
    handleSyncFilters,
    handlePreviewRows,
  } = useTabularDataFilterStep<T>({
    pluginId,
    dialogData,
    setValid,
    setError,
    shouldUploadFirst,
    keyValueValid,
    keyValueState,
    renderSections,
    onFiltersChanged,
    onPreviewReady,
    translationNamespace,
    initialFilters,
    filtersFromAtom,
    syncFilters,
    menuContainer,
    dialogRef,
  });

  if (shouldUploadFirst || !tableMetadata) {
    return (
      <Box display="grid" gap={0.5}>
        <Typography color="text.secondary">
          {t('filtering.instructions.uploadFirst', 'Upload a dataset in Step 1 to configure filters.')}
        </Typography>
        {dialogData?.dataSource?.source ? (
          <Typography variant="body2" color="text.secondary">
            {t(
              'filtering.instructions.previousSource',
              'Previous source: {{value}}. Reopen Step 1 to re-download the tabular file.',
              { value: dialogData.dataSource.source },
            )}
          </Typography>
        ) : null}
      </Box>
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
  return (
    <TabularDataFilter
      tableMetadata={tableMetadata}
      pluginId={pluginId}
      onPreviewData={stablePreviewHandler}
      onPreviewRows={handlePreviewRows}
      initialFilters={stableInitialFilters}
      onSyncFilters={handleSyncFilters}
      menuContainer={menuContainer}
      renderSections={
        renderSections ??
        ((sections) => (
          <TabularFilterSections
            sections={sections}
            translationNamespace={renderSectionsProps.translationNamespace}
            columns={renderSectionsProps.columns}
            selectedKeyColumn={renderSectionsProps.selectedKeyColumn}
            selectedValueColumn={renderSectionsProps.selectedValueColumn}
            onKeyColumnChange={renderSectionsProps.onKeyColumnChange}
            onValueColumnChange={renderSectionsProps.onValueColumnChange}
            dialogRef={renderSectionsProps.dialogRef}
            menuContainer={renderSectionsProps.menuContainer}
            showPreview={showPreview}
          />
        ))
      }
    />
  );
};

export const TabularDataFilterStep = <T extends SpreadsheetDraft>({
  data,
  onChange,
  setValid,
  setError,
  dialogRef,
  renderSections,
  onFiltersChanged,
  onPreviewReady,
  translationNamespace,
  showPreview = true,
  mode,
  disabled,
}: TabularDataFilterStepProps<T>) => {
  const {
    pluginId,
    tabularApi,
    menuContainer,
    initialFilters,
    shouldUploadFirst,
    syncFilters,
    handlePreviewData,
    dialogData,
    filtersFromAtom,
    keyValueState,
    keyValueValid,
  } = useTabularDataFilterStepView<T>({
    data,
    onChange,
    setValid,
    setError,
    dialogRef,
    renderSections,
    onFiltersChanged,
    onPreviewReady,
    translationNamespace,
    showPreview,
    mode,
    disabled,
  });

  return (
    <TabularProvider tabularApi={tabularApi}>
      <TabularDataFilterInner
        pluginId={pluginId}
        menuContainer={menuContainer}
        initialFilters={initialFilters}
        shouldUploadFirst={shouldUploadFirst}
        syncFilters={syncFilters}
        handlePreviewData={handlePreviewData}
        dialogData={dialogData}
        tabularApi={tabularApi}
        setValid={setValid}
        setError={setError}
        renderSections={renderSections}
        onFiltersChanged={onFiltersChanged}
        onPreviewReady={onPreviewReady}
        keyValueState={keyValueState}
        keyValueValid={keyValueValid}
        dialogRef={dialogRef}
        translationNamespace={translationNamespace}
        filtersFromAtom={filtersFromAtom}
        showPreview={showPreview}
      />
    </TabularProvider>
  );
};
