import type { ElementType } from 'react';
import {
  STYLE_TYPE_OPTIONS,
  type StylerDialogData,
  type StylerStepData,
  type StyleType,
} from '../../common/types/StylerEntity.ts';
import { useTranslation } from 'react-i18next';
import { Box, FormHelperText, Paper, Stack, Typography } from '@mui/material';
import {
  MAPLIBRE_PROPERTY_GROUPS,
  MAPLIBRE_PROPERTY_METADATA,
  type MapLibreStyleProperty,
  type PropertyGroup,
} from '@hierarchidb/styler-plugin';
import { useIconRegistry } from '@hierarchidb/ui-icon';
import Grid from '@mui/material/Grid';
import {
  BorderColor as BorderColorIcon,
  FormatColorFill as FormatColorFillIcon,
  HelpOutline as HelpOutlineIcon,
  Highlight as HighlightIcon,
  LineWeight as LineWeightIcon,
  Opacity as OpacityIcon,
  RadioButtonChecked as RadioButtonCheckedIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
  TextFields as TextFieldsIcon,
} from '@mui/icons-material';

const TARGET_PROPERTY_CARDS: Record<
  MapLibreStyleProperty,
  {
    icon: ElementType;
    labelKey: string;
    descriptionKey: string;
    defaultLabel: string;
    defaultDescription: string;
  }
> = {
  'fill-color': {
    icon: FormatColorFillIcon,
    labelKey: 'styleSettings.targetProperty.options.fillColor',
    descriptionKey: 'styleSettings.targetProperty.descriptions.fillColor',
    defaultLabel: 'Fill Color',
    defaultDescription: 'Apply data-driven color fills to areas like polygons or regions.',
  },
  'fill-opacity': {
    icon: OpacityIcon,
    labelKey: 'styleSettings.targetProperty.options.fillOpacity',
    descriptionKey: 'styleSettings.targetProperty.descriptions.fillOpacity',
    defaultLabel: 'Fill Opacity',
    defaultDescription: 'Control the transparency of area fills using numeric values.',
  },
  'line-color': {
    icon: BorderColorIcon,
    labelKey: 'styleSettings.targetProperty.options.lineColor',
    descriptionKey: 'styleSettings.targetProperty.descriptions.lineColor',
    defaultLabel: 'Line Color',
    defaultDescription: 'Apply data-driven colors to line or route strokes.',
  },
  'line-width': {
    icon: LineWeightIcon,
    labelKey: 'styleSettings.targetProperty.options.lineWidth',
    descriptionKey: 'styleSettings.targetProperty.descriptions.lineWidth',
    defaultLabel: 'Line Width',
    defaultDescription: 'Scale line thickness based on numeric values.',
  },
  'line-opacity': {
    icon: OpacityIcon,
    labelKey: 'styleSettings.targetProperty.options.lineOpacity',
    descriptionKey: 'styleSettings.targetProperty.descriptions.lineOpacity',
    defaultLabel: 'Line Opacity',
    defaultDescription: 'Set line transparency using numeric values.',
  },
  'circle-color': {
    icon: RadioButtonCheckedIcon,
    labelKey: 'styleSettings.targetProperty.options.circleColor',
    descriptionKey: 'styleSettings.targetProperty.descriptions.circleColor',
    defaultLabel: 'Circle Color',
    defaultDescription: 'Color points or markers using data values.',
  },
  'circle-radius': {
    icon: RadioButtonUncheckedIcon,
    labelKey: 'styleSettings.targetProperty.options.circleRadius',
    descriptionKey: 'styleSettings.targetProperty.descriptions.circleRadius',
    defaultLabel: 'Circle Radius',
    defaultDescription: 'Adjust point size with numeric values.',
  },
  'circle-opacity': {
    icon: OpacityIcon,
    labelKey: 'styleSettings.targetProperty.options.circleOpacity',
    descriptionKey: 'styleSettings.targetProperty.descriptions.circleOpacity',
    defaultLabel: 'Circle Opacity',
    defaultDescription: 'Control marker transparency using numeric values.',
  },
  'text-color': {
    icon: TextFieldsIcon,
    labelKey: 'styleSettings.targetProperty.options.textColor',
    descriptionKey: 'styleSettings.targetProperty.descriptions.textColor',
    defaultLabel: 'Text Color',
    defaultDescription: 'Style label text colors with data-driven values.',
  },
  'text-halo-color': {
    icon: HighlightIcon,
    labelKey: 'styleSettings.targetProperty.options.textHaloColor',
    descriptionKey: 'styleSettings.targetProperty.descriptions.textHaloColor',
    defaultLabel: 'Text Halo Color',
    defaultDescription: 'Set label halo colors to improve contrast on the map.',
  },
  'text-halo-width': {
    icon: LineWeightIcon,
    labelKey: 'styleSettings.targetProperty.options.textHaloWidth',
    descriptionKey: 'styleSettings.targetProperty.descriptions.textHaloWidth',
    defaultLabel: 'Text Halo Width',
    defaultDescription: 'Adjust halo thickness around label text.',
  },
};

export const StyleMappingTargetPanel = ({
  settings,
  handleStyleTypeChange,
  pluginData,
  handleTargetPropertyChange,
  showStyleType = true,
  showTargetProperty = true,
}: {
  settings: { styleType?: StyleType; colorScheme?: StylerStepData['colorScheme'] };
  handleStyleTypeChange: (styleType: StyleType) => void;
  pluginData: Partial<StylerDialogData>;
  handleTargetPropertyChange: (targetProperty: MapLibreStyleProperty) => void;
  showStyleType?: boolean;
  showTargetProperty?: boolean;
}) => {
  const { t } = useTranslation('styler-plugin');
  const { resolveIcon } = useIconRegistry();
  const selectedTargetProperty = pluginData.mapping?.targetProperty ?? null;

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
        <Box sx={{ mt: showStyleType ? 3 : 0 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            {t('styleSettings.targetProperty.label', 'Target style property')}
          </Typography>
          <Stack spacing={2}>
            {MAPLIBRE_PROPERTY_GROUPS.map((group: PropertyGroup) => (
              <Box key={group.name}>
                <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  {String(t(`styleSettings.targetProperty.groups.${group.name}`, group.displayName))}
                </Typography>
                <Grid container spacing={2}>
                  {group.properties.map((property: MapLibreStyleProperty) => {
                    const selected = selectedTargetProperty === property;
                    const card = TARGET_PROPERTY_CARDS[property];
                    const IconComponent = card?.icon ?? HelpOutlineIcon;
                    const displayName = MAPLIBRE_PROPERTY_METADATA[property].displayName;
                    return (
                      <Grid size={{ xs: 12, sm: 6, md: 4 }} key={property}>
                        <Paper
                          tabIndex={0}
                          onClick={() => handleTargetPropertyChange(property)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              handleTargetPropertyChange(property);
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
                              <IconComponent fontSize="small" />
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography variant="subtitle1" noWrap>
                                {String(t(card?.labelKey ?? '', card?.defaultLabel ?? displayName))}
                              </Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                {String(
                                  t(
                                    card?.descriptionKey ?? '',
                                    card?.defaultDescription ?? 'Choose this property to map your data onto the style.',
                                  ),
                                )}
                              </Typography>
                            </Box>
                          </Stack>
                        </Paper>
                      </Grid>
                    );
                  })}
                </Grid>
              </Box>
            ))}
          </Stack>
          <FormHelperText sx={{ mt: 1 }}>
            {t('styleSettings.targetProperty.help', 'Select the MapLibre paint property to map this value to.')}
          </FormHelperText>
        </Box>
      )}
    </>
  );
};
