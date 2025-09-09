/**
  * @file StylerStep5.tsx
 * @description Step 5 wrapper component for Styler configuration
 * :
 * : Spreadsheet
 * :
  */

import React, { useCallback } from 'react';
import { Box } from '@mui/material';
import { StylerConfiguration } from '../../components/step5/StylerConfiguration';
import type { StylerConfig } from '../../types/stylerTypes';
import { StylerConfigDefault } from '../../types/stylerTypes';

/**
  * : Step5
 * Spreadsheet
  */
export interface StylerStep5Props {
  data: any;
  onChange: (data: any) => void;
  onValidate?: (isValid: boolean) => void;
  //  CSVspreadsheet
  csvData?: Array<Record<string, any>>;
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
                                                          csvData = [],
                                                          columns = [],
                                                        }) => {
  const currentConfig: StylerConfig = data?.stylerConfig || StylerConfigDefault;

  //  :
  // const numericColumns = React.useMemo(() => {
  //   if (csvData.length === 0) return [];
  //
  //   return columns.filter(col => {
  //  //
  //     const sampleValues = csvData.slice(0, 10).map(row => row[col]);
  //     return sampleValues.some(val => typeof val === 'number' && !isNaN(val));
  //   });
  // }, [csvData, columns]);

  //  :
  const sampleValues = React.useMemo(() => {
    const valueColumn = data?.selectedValueColumn;
    if (!valueColumn || csvData.length === 0) return [];

    return csvData
      .map((row) => row[valueColumn])
      .filter((val) => typeof val === 'number' && !isNaN(val))
      .slice(0, 100); //  100
  }, [csvData, data?.selectedValueColumn]);

  const handleConfigChange = useCallback(
    (newConfig: StylerConfig) => {
      const updatedData = {
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
    [data, onChange, onValidate],
  );

  const handleColumnSelect = useCallback(
    (column: string, type: 'key' | 'value') => {
      const updatedData = {
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
          !!updatedData.stylerConfig.targetProperty && !!updatedData.selectedValueColumn;
        onValidate(hasRequiredFields);
      }
    },
    [data, currentConfig, onChange, onValidate],
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
        csvData={csvData}
      />
    </Box>
  );
};

/**
  * : Step
 * Spreadsheet
  */
export const StylerStep5Definition = {
  stepNumber: 5,
  title: 'Style Mapping Configuration',
  component: StylerStep5,
  validation: {
    validate: async (data: any) => {
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
