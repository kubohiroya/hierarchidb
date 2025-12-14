import type { StepComponentProps } from '@hierarchidb/plugin-base';
import type { TabularDataResult, TabularFilterRule } from '@hierarchidb/ui-tabular-extract';
import type { SpreadsheetEntity } from '../../common/types/SpreadsheetEntity.js';
import { TabularDataFilterStep, type TabularDataFilterStepProps } from './steps/TabularDataFilterStep.js';
import { useTabularKeyValueState } from '../hooks/useTabularKeyValueState.js';

export type TabularKeyValueStepProps<T extends SpreadsheetEntity> = StepComponentProps<T> & {
  translationNamespace?: string;
  renderSections?: TabularDataFilterStepProps<T>['renderSections'];
  onFiltersChanged?: (filters: TabularFilterRule[]) => void;
  onPreviewReady?: (preview: TabularDataResult) => void;
};

export const TabularKeyValueStep = <T extends SpreadsheetEntity>({
  data,
  onChange,
  setValid,
  setError,
  dialogRef,
  translationNamespace,
  renderSections,
  onFiltersChanged,
  onPreviewReady,
  ...rest
}: TabularKeyValueStepProps<T>) => {
  const { dialogData, renderSections: keyValueSections, handleFiltersChanged, handlePreviewReady, handleFilterStepValid } =
    useTabularKeyValueState<T>({
      data,
      onChange,
      setError,
      dialogRef,
      onSetFilterValid: setValid,
      translationNamespace,
    });

  return (
    <TabularDataFilterStep
      {...rest}
      data={dialogData}
      onChange={onChange}
      setValid={handleFilterStepValid}
      setError={setError}
      dialogRef={dialogRef}
      renderSections={renderSections ?? keyValueSections}
      onFiltersChanged={(filters) => {
        handleFiltersChanged(filters);
        onFiltersChanged?.(filters);
      }}
      onPreviewReady={(preview) => {
        handlePreviewReady(preview);
        onPreviewReady?.(preview);
      }}
    />
  );
};
