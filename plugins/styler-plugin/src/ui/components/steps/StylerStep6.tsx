/**
 * @file StylerStep6.tsx
 * @description Step 6 wrapper component for Styler table preview
 * :
 * :
 * :
 */

import { wrapDialogStepComponent } from '@hierarchidb/plugin-ui-sdk';
import { Alert, AlertTitle, Box } from '@mui/material';
import React, { useCallback, useMemo } from 'react';
import type { StylerConfig, StylerStepData } from '../../../common/types/stylerTypes.js';
import { StylerConfigDefault } from '../../../common/types/stylerTypes.js';
import { StylerTablePreview } from './StylerTablePreview.js';

import { StylerStepProps } from './StylerStepProps.js';


export const StylerStep6: React.FC<StylerStepProps> = ({
  data,
  onChange,
  onValidate,
  tabularData = [],
  // columns = [],
}) => {
  const config: StylerConfig = data?.stylerConfig || StylerConfigDefault;
  const selectedKeyColumn = data?.selectedKeyColumn;
  const selectedValueColumn = data?.selectedValueColumn;

  const previewData = useMemo(() => {
    //  1000
    return tabularData.slice(0, 1000);
  }, [tabularData]);

  //  :
  const handleColumnSelect = useCallback(
    (columnName: string, type: 'key' | 'value') => {
      const updatedData: StylerStepData = {
        ...data,
        [type === 'key' ? 'selectedKeyColumn' : 'selectedValueColumn']: columnName,
      };

      if (data?.stylerConfig) {
        updatedData.stylerConfig = {
          ...data.stylerConfig,
          [type === 'key' ? 'keyColumn' : 'valueColumn']: columnName,
        };
      }

      onChange(updatedData);
    },
    [data, onChange]
  );

  React.useEffect(() => {
    if (onValidate) {
      //  Step6
      onValidate(true);
    }
  }, [onValidate]);

  //  :
  if (!config.targetProperty || !selectedValueColumn) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">
          <AlertTitle>Configuration Required</AlertTitle>
          Please complete Step 5 configuration before viewing the preview.
          <ul>
            {!config.targetProperty && <li>Select a MapLibre style property</li>}
            {!selectedValueColumn && <li>Select a value column for mapping</li>}
          </ul>
        </Alert>
      </Box>
    );
  }

  if (tabularData.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          <AlertTitle>No Data Available</AlertTitle>
          No Tabular data is available for preview. Please ensure data has been loaded in previous
          steps.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', height: '100%', p: 2 }}>
      <StylerTablePreview
        data={previewData}
        selectedKeyColumn={selectedKeyColumn}
        selectedValueColumn={selectedValueColumn}
        config={config}
        onColumnSelect={handleColumnSelect}
        maxRows={1000}
        enableVirtualization={previewData.length > 100}
      />

      {/*
       */}
      {tabularData.length > 1000 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          Showing preview of first 1,000 rows. Full dataset contains{' '}
          {tabularData.length.toLocaleString()} rows.
        </Alert>
      )}
    </Box>
  );
};

/**
 * : Step
 */
const StylerStep6Component = wrapDialogStepComponent(StylerStep6);

export const StylerStep6Definition = {
  stepNumber: 6,
  title: 'Preview with Style Mapping',
  component: StylerStep6Component,
  validation: {
    validate: async (_data: StylerStepData) => {
      //  OK
      return { isValid: true, errors: [] };
    },
  },
};
