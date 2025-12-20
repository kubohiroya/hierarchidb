import { useState } from 'react';
import { useAtomValue } from 'jotai';
import {
  TabularDataFilter,
  TabularProvider,
  type TabularDataFilterProps,
  type TabularDataResult,
  type TabularFilterRule,
} from '@hierarchidb/ui-tabular-extract';
import type { SpreadsheetEntity } from '../../../common/types/SpreadsheetEntity.js';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useTabularDataFilter } from '../../hooks/useTabularDataFilter.js';
import { useTabularKeyValueState } from '../../hooks/useTabularKeyValueState.js';
import { filterRulesAtom } from '../../state/tabularKeyValueAtoms.js';
import { useTabularDataFilterStep } from '../../hooks/useTabularDataFilterStep.js';
import { TabularFilterSections } from '../TabularFilterSections.js';
import type { PluginStepProps } from '@hierarchidb/plugin-base';

type FilterInnerProps<T extends SpreadsheetEntity> = ReturnType<typeof useTabularDataFilter<T>> & {
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
};

const TabularDataFilterInner = <T extends SpreadsheetEntity>({
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
          />
        ))
      }
    />
  );
};

export interface TabularDataFilterStepProps<T extends SpreadsheetEntity> extends PluginStepProps<T> {
  renderSections?: TabularDataFilterProps['renderSections'];
  onFiltersChanged?: (filters: TabularFilterRule[]) => void;
  onPreviewReady?: (preview: TabularDataResult) => void;
  translationNamespace?: string;
}

export const TabularDataFilterStep = <T extends SpreadsheetEntity>({
  data,
  onChange,
  setValid,
  setError,
  dialogRef,
  renderSections,
  onFiltersChanged,
  onPreviewReady,
  translationNamespace,
}: TabularDataFilterStepProps<T>) => {
  const [keyValueValid, setKeyValueValid] = useState(false);
  const keyValueState = useTabularKeyValueState<T>({
    data,
    onChange,
    setError,
    onSetFilterValid: setKeyValueValid,
  });
  const {
    pluginId,
    tabularApi,
    menuContainer,
    initialFilters,
    shouldUploadFirst,
    syncFilters,
    handlePreviewData,
    dialogData,
  } = useTabularDataFilter<T>({ data, onChange, setValid, setError, dialogRef });
  const filtersFromAtom = useAtomValue(filterRulesAtom);

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
      />
    </TabularProvider>
  );
};
