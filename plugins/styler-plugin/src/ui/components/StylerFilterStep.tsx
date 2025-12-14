import type { StepComponentProps } from '@hierarchidb/plugin-base';
import { TabularDataFilterStep } from '@hierarchidb/spreadsheet-plugin';
import type { StylerStepData } from '../../common/types/StylerEntity.js';

export const StylerFilterStep: React.FC<StepComponentProps<StylerStepData>> = (props) => (
  <TabularDataFilterStep {...props} translationNamespace="styler-plugin" />
);
