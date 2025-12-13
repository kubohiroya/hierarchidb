import React, { useMemo } from 'react';
import type { StepComponentProps } from '@hierarchidb/plugin-base';
import {
  STYLE_TYPE_OPTIONS,
  type StylerStepData,
  type StylerTableRow,
} from '../../common/types/StylerEntity.ts';
import { calculateStatistics, extractNumericValues } from '../../common/utils/dataAnalysis.ts';
import { useTranslation } from 'react-i18next';
import { useStylerMappingState } from './useStylerMappingState.ts';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { StyleMappingSourcePanel } from './StyleMappingSourcePanel.tsx';
import { StyleMappingTargetPanel } from './StyleMappingTargetPanel.tsx';

export const StylerMappingStep: React.FC<
  StepComponentProps<StylerStepData> & { tabularData?: StylerTableRow[] }
> = ({
  data,
  onChange,
  setValid,
  setError,
  dialogRef,
  tabularData,
}) => {
  const { t } = useTranslation('styler-plugin');
  const {
    menuContainer,
    pluginData,
    columns,
    settings,
    handleKeyColumnChange,
    handleValueColumnChange,
    handleStyleTypeChange,
    handleTargetPropertyChange,
  } = useStylerMappingState({
    data,
    onChange,
    setValid,
    setError,
    dialogRef,
    styleTypeOptions: STYLE_TYPE_OPTIONS,
  });
  const selectedValueColumn =
    pluginData.mapping?.valueColumn ??
    pluginData.selectedValueColumn ??
    (pluginData.stylerConfig as { valueColumn?: string } | undefined)?.valueColumn ??
    '';

  const valueRows = useMemo(() => {
    if (Array.isArray(tabularData) && tabularData.length > 0) {
      return tabularData;
    }
    const previewRows = pluginData.lastPreview?.rows;
    if (Array.isArray(previewRows) && previewRows.length > 0) {
      return previewRows as StylerTableRow[];
    }
    return [] as StylerTableRow[];
  }, [pluginData.lastPreview?.rows, tabularData]);

  const numericValues = useMemo(() => {
    if (!selectedValueColumn) return [];
    return extractNumericValues(valueRows, selectedValueColumn);
  }, [selectedValueColumn, valueRows]);

  const stats = useMemo(() => {
    if (!selectedValueColumn || numericValues.length === 0) return null;
    const base = calculateStatistics(numericValues);
    return {
      min: base.min,
      max: base.max,
      mean: base.mean,
      median: base.median,
      stdDev: base.stdDev,
      count: base.totalCount,
    };
  }, [numericValues, selectedValueColumn]);

  return (
    <Stack spacing={2}>
      <Typography variant="h6">
        {t('styleSettings.title', 'Style Mapping')}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {t(
          'styleSettings.description',
          'Select the style type, data source column, and target property before configuring algorithms.',
        )}
      </Typography>
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1">
            {t('styleSettings.accordion.styleType', 'Style Type')}
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <StyleMappingTargetPanel
            settings={settings}
            handleStyleTypeChange={handleStyleTypeChange}
            pluginData={pluginData}
            menuContainer={menuContainer}
            handleTargetPropertyChange={handleTargetPropertyChange}
            showTargetProperty={false}
          />
        </AccordionDetails>
      </Accordion>

      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1">
            {t('styleSettings.accordion.targetProperty', 'Target Property')}
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <StyleMappingTargetPanel
            settings={settings}
            handleStyleTypeChange={handleStyleTypeChange}
            pluginData={pluginData}
            menuContainer={menuContainer}
            handleTargetPropertyChange={handleTargetPropertyChange}
            showStyleType={false}
          />
        </AccordionDetails>
      </Accordion>

      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1">
            {t('styleSettings.accordion.keyValuePair', 'Key-Value Pair')}
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              {t(
                'styleSettings.keyValuePair.description',
                'Select the key and value columns to drive styling and review basic statistics.',
              )}
            </Typography>
            <StyleMappingSourcePanel {...{
              pluginData,
              handleKeyColumnChange,
              menuContainer,
              columns,
              handleValueColumnChange,
            }} />
            <Divider />
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                {t('styleSettings.keyValuePair.stats.title', 'Value statistics')}
              </Typography>
              {stats ? (
                <Stack direction="row" spacing={1} flexWrap="wrap" rowGap={1}>
                  <Chip size="small" label={`${t('styleSettings.keyValuePair.stats.count', 'Count')}: ${stats.count}`} />
                  <Chip size="small" label={`${t('styleSettings.keyValuePair.stats.min', 'Min')}: ${stats.min}`} />
                  <Chip size="small" label={`${t('styleSettings.keyValuePair.stats.max', 'Max')}: ${stats.max}`} />
                  <Chip size="small" label={`${t('styleSettings.keyValuePair.stats.mean', 'Average')}: ${stats.mean.toFixed(2)}`} />
                  <Chip size="small" label={`${t('styleSettings.keyValuePair.stats.median', 'Median')}: ${stats.median.toFixed(2)}`} />
                  <Chip size="small" label={`${t('styleSettings.keyValuePair.stats.stdDev', 'Std Dev')}: ${stats.stdDev.toFixed(2)}`} />
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {t(
                    'styleSettings.keyValuePair.stats.empty',
                    'Select a value column with numeric values to view statistics.',
                  )}
                </Typography>
              )}
            </Box>
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Stack>
  );
};
