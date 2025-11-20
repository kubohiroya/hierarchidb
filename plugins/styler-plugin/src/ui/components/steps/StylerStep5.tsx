import { wrapDialogStepComponent } from '@hierarchidb/plugin-ui-sdk';
// import { wrapDialogStepComponent } from '@hierarchidb/plugin-api';
import { Box } from '@mui/material';
import React, { useCallback } from 'react';
// import { StylerConfiguration } from '../../components/step5/StylerConfiguration.js';
import type { StylerConfig, StylerTableRow } from '../../../common/types/stylerTypes.js';
import { StylerConfigDefault } from '../../../common/types/stylerTypes.js';
import { StylerConfiguration } from './StylerConfiguration.js';

export interface StylerStep5Data {
  stylerConfig?: StylerConfig;
  selectedKeyColumn?: string;
  selectedValueColumn?: string;
}

export interface StylerStep5Props {
  data: StylerStep5Data;
  onChange: (data: StylerStep5Data) => void;
  onValidate?: (isValid: boolean) => void;
  //  Tabularspreadsheet
  tabularData?: StylerTableRow[];
  columns?: string[];
}

/**
 * : Styler Step5
 * : StylerConfiguration
 * :
 * : Spreadsheet
 */
export const StylerStep5: React.FC<StylerStep5Props> = ({
  data,
  onChange,
  onValidate,
  tabularData = [],
  columns = [],
}) => {
  const currentConfig: StylerConfig = data?.stylerConfig || StylerConfigDefault;

  //  :
  // const numericColumns = React.useMemo(() => {
  //   if (tabularData.length === 0) return [];
  //
  //   return columns.filter(col => {
  //  //
  //     const sampleValues = tabularData.slice(0, 10).map(row => row[col]);
  //     return sampleValues.some(val => typeof val === 'number' && !isNaN(val));
  //   });
  // }, [tabularData, columns]);

  //  :
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
      const updatedData: StylerStep5Data = {
        ...data,
        stylerConfig: newConfig,
      };
      onChange(updatedData);

      //  : targetProperty
      if (onValidate) {
        const isValid = !!newConfig.targetProperty;
        onValidate(isValid);
      }
    },
    [data, onChange, onValidate]
  );

  const handleColumnSelect = useCallback(
    (column: string, type: 'key' | 'value') => {
      const updatedData: StylerStep5Data = {
        ...data,
        [type === 'key' ? 'selectedKeyColumn' : 'selectedValueColumn']: column,
        stylerConfig: {
          ...currentConfig,
          [type === 'key' ? 'keyColumn' : 'valueColumn']: column,
        },
      };
      onChange(updatedData);

      if (onValidate) {
        const hasRequiredFields =
          !!updatedData.stylerConfig?.targetProperty && !!updatedData.selectedValueColumn;
        onValidate(hasRequiredFields);
      }
    },
    [data, currentConfig, onChange, onValidate]
  );

  return (
    <Box sx={{ width: '100%', p: 2 }}>
      <StylerConfiguration
        config={currentConfig}
        onChange={handleConfigChange}
        values={sampleValues}
        columns={columns}
        selectedKeyColumn={data?.selectedKeyColumn}
        selectedValueColumn={data?.selectedValueColumn}
        onColumnSelect={handleColumnSelect}
        tabularData={tabularData}
      />
    </Box>
  );
};

/**
 * : Step
 * Spreadsheet
 */
const StylerStep5Component = wrapDialogStepComponent(StylerStep5);

export const StylerStep5Definition = {
  stepNumber: 5,
  title: 'Style Mapping Configuration',
  component: StylerStep5Component,
  validation: {
    validate: async (data: StylerStep5Data) => {
      const config = data?.stylerConfig;

      if (!config?.targetProperty) {
        return {
          isValid: false,
          errors: ['Please select a MapLibre style property to map'],
        };
      }

      if (!data?.selectedValueColumn) {
        return {
          isValid: false,
          errors: ['Please select a value column for mapping'],
        };
      }

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
