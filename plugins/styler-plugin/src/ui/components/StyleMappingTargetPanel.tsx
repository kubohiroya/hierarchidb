import {
  STYLE_TYPE_OPTIONS,
  type StylerDialogData,
  type StylerStepData,
  type StyleType,
} from '../../common/types/StylerEntity.ts';
import { useTranslation } from 'react-i18next';
import { Box, FormControl, FormHelperText, InputLabel, MenuItem, Paper, Stack, Typography } from '@mui/material';
import {
  MAPLIBRE_PROPERTY_GROUPS,
  MAPLIBRE_PROPERTY_METADATA,
  type MapLibreStyleProperty,
} from '@hierarchidb/styler-plugin';
import { useIconRegistry } from '@hierarchidb/ui-icon';
import Grid from '@mui/material/Grid';
import { ModalSelect } from '@hierarchidb/ui-modal-select';
import { useId } from 'react';

export const StyleMappingTargetPanel = ({
                                   settings,
                                          handleStyleTypeChange,
                                   pluginData,
                                   menuContainer,
                                   handleTargetPropertyChange,
                                   showStyleType = true,
                                   showTargetProperty = true,
                                 }: {
  settings: { styleType?: StyleType; colorScheme?: StylerStepData['colorScheme'] },
  handleStyleTypeChange: (styleType:StyleType) => void,
  pluginData: Partial<StylerDialogData>,
  menuContainer: Element | null,
  handleTargetPropertyChange: (targetProperty: MapLibreStyleProperty) => void,
  showStyleType?: boolean,
  showTargetProperty?: boolean
}) => {
  const { t } = useTranslation('styler-plugin');
  const { resolveIcon } = useIconRegistry();
  const targetPropertyLabelId = useId();

  return (
    <>
      {showStyleType && (
        <Box>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            {t('styleSettings.styleType.label', 'Style Type')}
          </Typography>
          <Grid container spacing={2}>
            {STYLE_TYPE_OPTIONS.map((option) => {
              const selected = settings.styleType === option.value;
              const IconEl = resolveIcon({ nodeType: option.icon });
              return (
                <Grid size={{ xs: 12, sm: 4 }} key={option.value}>
                  <Paper
                    tabIndex={0}
                    onClick={() => handleStyleTypeChange(option.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleStyleTypeChange(option.value);
                      }
                    }}
                    elevation={selected ? 4 : 1}
                    sx={{
                      p: 2,
                      border: selected ? '2px solid' : '1px solid',
                      borderColor: selected ? 'primary.main' : 'divider',
                      borderRadius: 2,
                      cursor: 'pointer',
                      height: '100%',
                      transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                      '&:hover': {
                        borderColor: 'primary.main',
                        boxShadow: (theme) => theme.shadows[2],
                      },
                      outline: 'none',
                    }}
                  >
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Box
                        sx={{
                          width: 44,
                          height: 44,
                          borderRadius: '50%',
                          bgcolor: selected ? 'primary.light' : 'grey.100',
                          color: selected ? 'primary.contrastText' : 'text.secondary',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: selected ? '1px solid' : '1px solid',
                          borderColor: selected ? 'primary.main' : 'divider',
                          flexShrink: 0,
                        }}
                      >
                        {IconEl}
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle1" noWrap>
                          {t(option.labelKey, option.labelKey)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {t(option.descriptionKey, option.descriptionKey)}
                        </Typography>
                      </Box>
                    </Stack>
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
          <FormHelperText sx={{ mt: 1 }}>
            {t('styleSettings.styleType.help', 'Select the geometry that this style targets.')}
          </FormHelperText>
        </Box>
      )}

      {showTargetProperty && (
        <FormControl fullWidth required sx={{ mt: showStyleType ? 3 : 0 }}>
          <InputLabel id={targetPropertyLabelId} htmlFor="styler-target-property">
            {t('styleSettings.targetProperty.label', 'Target style property')}
          </InputLabel>
          <ModalSelect
            name='styler-target-property'
            labelId={targetPropertyLabelId}
            value={
              (pluginData as { stylerConfig?: { targetProperty?: MapLibreStyleProperty | null } })
                ?.stylerConfig?.targetProperty ??
              pluginData.mapping?.targetProperty ??
              ''
            }
            label={t('styleSettings.targetProperty.label', 'Target style property')}
            onChange={(event) => handleTargetPropertyChange(event.target.value as MapLibreStyleProperty)}
            renderValue={(selected) =>
              selected
                ? MAPLIBRE_PROPERTY_METADATA[selected as MapLibreStyleProperty].displayName
                : ''
            }
            menuContainer={menuContainer}
            usePortal={false}
            menuZIndexOffset={200}
          >
            {MAPLIBRE_PROPERTY_GROUPS.flatMap((group) => [
              <MenuItem key={`${group.name}-label`} value="" disabled>
                <Typography variant="overline" color="text.secondary">
                  {group.displayName}
                </Typography>
              </MenuItem>,
              ...group.properties.map((property) => (
                <MenuItem key={property} value={property}>
                  {MAPLIBRE_PROPERTY_METADATA[property].displayName}
                </MenuItem>
              )),
            ])}
          </ModalSelect>
          <FormHelperText>
            {t('styleSettings.targetProperty.help', 'Select the MapLibre paint property to map this value to.')}
          </FormHelperText>
        </FormControl>
      )}
    </>
  );
};
