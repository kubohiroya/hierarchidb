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
import { useTranslation } from 'react-i18next';
import { i18n } from '@hierarchidb/ui-i18n';
import { StylerConfig, StylerMapping, StylerMappingDefault, StylerStepData } from '../../common/types/StylerEntity.js';
import { StylerConfigDefault } from '../../common/types/StylerEntity.js';
import { StylerPreviewPanel } from './StylerPreviewPanel.tsx';

import { StylerStepProps } from './StylerStepProps.tsx';

const getStylerT = () =>
  typeof i18n.getFixedT === 'function'
    ? i18n.getFixedT(i18n.language ?? 'en', 'styler-plugin')
    : (i18n.t.bind(i18n) as typeof i18n.t);

export const StylerPreviewStep: React.FC<StylerStepProps> = ({
  data,
  onChange,
  onValidate,
  tabularData = [],
  // columns = [],
}) => {
  const { t } = useTranslation('styler-plugin');
  const config: StylerConfig = data?.stylerConfig || StylerConfigDefault;
  const mapping: StylerMapping = data?.mapping || StylerMappingDefault;
  const keyColumn = data?.selectedKeyColumn;
  const valueColumn = data?.selectedValueColumn;

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
  if (!mapping || !keyColumn || !valueColumn) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">
          <AlertTitle>{t('step6.required.title', 'Configuration Required')}</AlertTitle>
          {t(
            'step6.required.body',
            'Please complete Step 5 configuration before viewing the preview.'
          )}
          <ul>
            {!keyColumn && (
              <li>{t('step6.required.keyColumn', 'Select a key column for mapping')}</li>
            )}
            {!valueColumn && (
              <li>{t('step6.required.valueColumn', 'Select a value column for mapping')}</li>
            )}
          </ul>
        </Alert>
      </Box>
    );
  }

  if (tabularData.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          <AlertTitle>{t('step6.noData.title', 'No Data Available')}</AlertTitle>
          {t(
            'step6.noData.body',
            'No tabular data is available for preview. Please ensure data has been loaded in previous steps.'
          )}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', height: '100%', p: 2 }}>
      <StylerPreviewPanel
        data={previewData}
        selectedKeyColumn={keyColumn}
        selectedValueColumn={valueColumn}
        mapping={mapping}
        config={config}
        onColumnSelect={handleColumnSelect}
        maxRows={1000}
        enableVirtualization={previewData.length > 100}
      />

      {/*
       */}
      {tabularData.length > 1000 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          {t('step6.truncate', 'Showing preview of first 1,000 rows. Full dataset contains')}{' '}
          {tabularData.length.toLocaleString()} {t('step6.rows', 'rows.') }
        </Alert>
      )}
    </Box>
  );
};

/**
 * : Step
 */
const StylerPreviewComponent = wrapDialogStepComponent(StylerPreviewStep);

export const StylerPreviewDefinition = {
  stepNumber: 6,
  get title() {
    const t = getStylerT();
    return t('step6.title', 'Preview with Style Mapping');
  },
  component: StylerPreviewComponent,
  validation: {
    validate: async (_data: StylerStepData) => {
      //  OK
      return { isValid: true, errors: [] };
    },
  },
};
