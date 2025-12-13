import { wrapDialogStepComponent } from '@hierarchidb/plugin-ui-sdk';
import { Box } from '@mui/material';
import React, { useCallback } from 'react';
import { i18n } from '@hierarchidb/ui-i18n';
import { StylerConfig, StylerStepData } from '../../common/types/StylerEntity.js';
import { StylerConfigDefault } from '../../common/types/StylerEntity.js';
import { StylerConfigPanel } from './StylerConfigPanel.tsx';
import { StylerStepProps } from './StylerStepProps.tsx';

const getStylerT = () =>
  typeof i18n.getFixedT === 'function'
    ? i18n.getFixedT(i18n.language ?? 'en', 'styler-plugin')
    : (i18n.t.bind(i18n) as typeof i18n.t);

export const StylerConfigStep: React.FC<StylerStepProps> = ({
  data,
  onChange,
  onValidate,
  tabularData = [],
}) => {
  const currentConfig: StylerConfig = data?.stylerConfig || StylerConfigDefault;

  const sampleValues = React.useMemo(() => {
    const valueColumn = data?.selectedValueColumn;
    if (!valueColumn || tabularData.length === 0) return [];

    return tabularData
      .map((row) => row[valueColumn])
      .filter((val): val is number => typeof val === 'number' && !Number.isNaN(val))
      .slice(0, 100);
  }, [tabularData, data?.selectedValueColumn]);

  const handleConfigChange = useCallback(
    (newConfig: StylerConfig) => {
      const updatedData: StylerStepData = {
        ...data,
        stylerConfig: newConfig,
      };
      onChange(updatedData);

      if (onValidate) {
        const isValid = newConfig.min < newConfig.max;
        onValidate(isValid);
      }
    },
    [data, onChange, onValidate]
  );

  return (
    <Box sx={{ width: '100%', p: 2 }}>
      <StylerConfigPanel
        config={currentConfig}
        onChange={handleConfigChange}
        values={sampleValues}
        selectedValueColumn={data?.selectedValueColumn}
        tabularData={tabularData}
      />
    </Box>
  );
};

const StylerConfigStepComponent = wrapDialogStepComponent(StylerConfigStep);

export const StylerConfigStepDefinition = {
  stepNumber: 5,
  get title() {
    const t = getStylerT();
    return t('step5.title', 'Style Algorithm');
  },
  component: StylerConfigStepComponent,
  validation: {
    validate: async (data: StylerStepData) => {
      const config = data?.stylerConfig ?? StylerConfigDefault;
      if (config.min >= config.max) {
        return {
          isValid: false,
          errors: [
            getStylerT()(
              'step5.errors.range',
              'Maximum value must be greater than minimum value'
            ),
          ],
        };
      }

      return { isValid: true, errors: [] };
    },
  },
};
