import { useState } from 'react';
import { useAtomValue } from 'jotai';
import type {
  TabularDataFilterProps,
  TabularDataResult,
  TabularFilterRule,
} from '@hierarchidb/ui-tabular';
import type { SpreadsheetEntity } from '../../../common/types/SpreadsheetEntity.js';
import { useTabularDataFilter } from '../../hooks/useTabularDataFilter.js';
import { useTabularKeyValueState } from '../../hooks/useTabularKeyValueState.js';
import { filterRulesAtom } from '../../state/tabularKeyValueAtoms.js';
import type { PluginStepProps } from '@hierarchidb/plugin-base';

export interface TabularDataFilterStepProps<T extends SpreadsheetEntity> extends PluginStepProps<T> {
  renderSections?: TabularDataFilterProps['renderSections'];
  onFiltersChanged?: (filters: TabularFilterRule[]) => void;
  onPreviewReady?: (preview: TabularDataResult) => void;
  translationNamespace?: string;
  showPreview?: boolean;
}

export const useTabularDataFilterStepView = <T extends SpreadsheetEntity>({
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

  return {
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
    renderSections,
    onFiltersChanged,
    onPreviewReady,
    translationNamespace,
    showPreview,
  };
};
