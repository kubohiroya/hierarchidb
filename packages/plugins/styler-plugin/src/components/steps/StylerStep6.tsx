/**
  * @file StylerStep6.tsx
 * @description Step 6 wrapper component for Styler table preview
 * :
 * :
 * :
  */

import React, { useCallback, useMemo } from 'react';
import { wrapDialogStepComponent } from '@hierarchidb/plugins-folder-plugin';
import { Alert, AlertTitle, Box } from '@mui/material';
import { StylerTablePreview } from '../../components/step6/StylerTablePreview.js';
import type { StylerConfig } from '../../types/stylerTypes.js';
import { StylerConfigDefault } from '../../types/stylerTypes.js';

/**
  * : Step6
  */
export interface StylerStep6Props {
  data: any;
  onChange: (data: any) => void;
  onValidate?: (isValid: boolean) => void;
  //  CSV
  csvData?: Array<Record<string, any>>;
  columns?: string[];
}

/**
  * : Styler Step6
 * : StylerTablePreview
 * :
 * :
  */
export const StylerStep6: React.FC<StylerStep6Props> = ({
                                                          data,
                                                          onChange,
                                                          onValidate,
                                                          csvData = [],
                                                          // columns = [],
                                                        }) => {
  const config: StylerConfig = data?.stylerConfig || StylerConfigDefault;
  const selectedKeyColumn = data?.selectedKeyColumn;
  const selectedValueColumn = data?.selectedValueColumn;

  const previewData = useMemo(() => {
    //  1000
    return csvData.slice(0, 1000);
  }, [csvData]);

  //  :
  const handleColumnSelect = useCallback(
    (columnName: string, type: 'key' | 'value') => {
      const updatedData = {
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
    [data, onChange],
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

  if (csvData.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          <AlertTitle>No Data Available</AlertTitle>
          No CSV data is available for preview. Please ensure data has been loaded in previous
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
      {csvData.length > 1000 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          Showing preview of first 1,000 rows. Full dataset contains{' '}
          {csvData.length.toLocaleString()} rows.
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
    validate: async (_data: any) => {
      //  OK
      return { isValid: true, errors: [] };
    },
  },
};
