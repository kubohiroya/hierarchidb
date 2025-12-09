import { wrapDialogStepComponent } from '@hierarchidb/plugin-ui-sdk';
import { Box } from '@mui/material';
import React, { useCallback } from 'react';
import type { StylerConfig, StylerStepData } from '../../../common/types/stylerTypes.js';
import { StylerConfigDefault } from '../../../common/types/stylerTypes.js';
import { StylerMapping } from './StylerMapping.js';
import { StylerStepProps } from './StylerStepProps.js';

export const StylerStep5: React.FC<StylerStepProps> = ({
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
        const isValid = newConfig.mapping.min < newConfig.mapping.max;
        onValidate(isValid);
      }
    },
    [data, onChange, onValidate]
  );

  return (
    <Box sx={{ width: '100%', p: 2 }}>
      <StylerMapping
        config={currentConfig}
        onChange={handleConfigChange}
        values={sampleValues}
        selectedValueColumn={data?.selectedValueColumn}
        tabularData={tabularData}
      />
    </Box>
  );
};

const StylerStep5Component = wrapDialogStepComponent(StylerStep5);

export const StylerStep5Definition = {
  stepNumber: 5,
  title: 'Style Algorithm',
  component: StylerStep5Component,
  validation: {
    validate: async (data: StylerStepData) => {
      const config = data?.stylerConfig ?? StylerConfigDefault;

      if (config.mapping.min >= config.mapping.max) {
        return {
          isValid: false,
          errors: ['Maximum value must be greater than minimum value'],
        };
      }

      return { isValid: true, errors: [] };
    },
  },
};
