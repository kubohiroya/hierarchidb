import type { StepComponentProps } from '@hierarchidb/plugin-base';
import { TabularDataFilterStep } from '@hierarchidb/spreadsheet-plugin';
import { useStylerFilterState } from './useStylerFilterState.js';
import type { StylerStepData } from '../../common/types/StylerEntity.js';

export const StylerFilterStep: React.FC<StepComponentProps<StylerStepData>> = ({
  data,
  onChange,
  setValid,
  setError,
  dialogRef,
  ...rest
}) => {
  const { dialogData, renderSections, handleFiltersChanged, handlePreviewReady, handleFilterStepValid } =
    useStylerFilterState({
      data,
      onChange,
      setError,
      dialogRef,
      onSetFilterValid: setValid,
    });

  return (
    <TabularDataFilterStep
      {...rest}
      data={dialogData}
      onChange={onChange}
      setValid={handleFilterStepValid}
      setError={setError}
      dialogRef={dialogRef}
      renderSections={renderSections}
      onFiltersChanged={handleFiltersChanged}
      onPreviewReady={handlePreviewReady}
    />
  );
};
