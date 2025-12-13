import type { StepComponentProps } from '@hierarchidb/plugin-base';
import {
  STYLE_TYPE_OPTIONS,
  type StylerStepData,
} from '../../common/types/StylerEntity.ts';
import { useTranslation } from 'react-i18next';
import { useStylerMappingState } from './useStylerMappingState.ts';
import { Box, Typography } from '@mui/material';
import { StyleMappingSourcePanel } from './StyleMappingSourcePanel.tsx';
import { StyleMappingTargetPanel } from './StyleMappingTargetPanel.tsx';

export const StylerMappingStep: React.FC<StepComponentProps<StylerStepData>> = ({
                                                                                  data,
                                                                                  onChange,
                                                                                  setValid,
                                                                                  setError,
                                                                                  dialogRef,
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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h6">
        {t('styleSettings.title', 'Style Mapping')}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {t(
          'styleSettings.description',
          'Select the style type, data source column, and target property before configuring algorithms.',
        )}
      </Typography>
      <StyleMappingSourcePanel {...{
        pluginData,
        handleKeyColumnChange,
        menuContainer,
        columns,
        handleValueColumnChange,
      }} />
      <StyleMappingTargetPanel {...{
        settings,
        handleStyleTypeChange,
        pluginData,
        menuContainer,
        handleTargetPropertyChange,
      }} />
    </Box>
  );
};