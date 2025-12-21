import type { PluginStepProps } from '@hierarchidb/plugin-base';
import { TabularDataFilterStep } from '@hierarchidb/spreadsheet-plugin';
import type { StylerStepData } from '../../common/types/StylerEntity.js';

export const StylerFilterStep: React.FC<PluginStepProps<StylerStepData>> = (props) => (
  <TabularDataFilterStep {...props} translationNamespace="styler-plugin" />
);
