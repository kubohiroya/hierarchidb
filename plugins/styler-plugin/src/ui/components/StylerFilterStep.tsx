import type { StepComponentProps } from '@hierarchidb/plugin-base';
import { TabularKeyValueStep } from '@hierarchidb/spreadsheet-plugin';
import type { StylerStepData } from '../../common/types/StylerEntity.js';

export const StylerFilterStep: React.FC<StepComponentProps<StylerStepData>> = (props) => (
  <TabularKeyValueStep {...props} translationNamespace="styler-plugin" />
);
