import React, { useEffect, useMemo, useState } from 'react';
import type { StepComponentProps } from '@hierarchidb/plugin-base';
import {
  STYLE_TYPE_OPTIONS,
  type StylerStepData,
  type StylerConfig,
  StylerConfigDefault,
  MAPLIBRE_PROPERTY_METADATA,
} from '../../common/types/StylerEntity.ts';
import { useTranslation } from 'react-i18next';
import { useStylerMappingState } from './useStylerMappingState.ts';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Slider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PaletteIcon from '@mui/icons-material/Palette';
import ContrastIcon from '@mui/icons-material/Contrast';
import { StyleMappingTargetPanel } from './StyleMappingTargetPanel.tsx';
import { generateColorGradient } from '../../common/utils/colorUtils.ts';

export const StylerMappingStep: React.FC<
  StepComponentProps<StylerStepData>
> = ({
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
    settings,
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

  const valueColumn =
    pluginData.mapping?.valueColumn ??
    pluginData.selectedValueColumn ??
    (pluginData.stylerConfig as { valueColumn?: string } | undefined)?.valueColumn ??
    '';

  const targetProperty = pluginData.mapping?.targetProperty ?? null;
  const targetMeta = targetProperty ? MAPLIBRE_PROPERTY_METADATA[targetProperty] : null;
  const isColorTarget = targetMeta?.type === 'color';

  const initialConfig = useMemo<StylerConfig>(() => {
    const cfg = pluginData.stylerConfig ?? StylerConfigDefault;
    return { ...StylerConfigDefault, ...cfg };
  }, [pluginData.stylerConfig]);

  const [localConfig, setLocalConfig] = useState<StylerConfig>(initialConfig);

  useEffect(() => {
    setLocalConfig((prev) => ({ ...prev, ...initialConfig }));
  }, [initialConfig]);

  const applyConfigPatch = (patch: Partial<StylerConfig>) => {
    setLocalConfig((prev) => {
      const next = { ...prev, ...patch };
      onChange({
        ...(pluginData as StylerStepData),
        stylerConfig: next,
      });
      return next;
    });
  };

  const presetScales: Array<{ id: string; label: string; stops: string[] }> = useMemo(
    () => [
      { id: 'grayscale', label: t('styleSettings.algorithm.scale.grayscale', 'Grayscale'), stops: ['#ffffff', '#000000'] },
      { id: 'red-blue', label: t('styleSettings.algorithm.scale.redBlue', 'Red → Blue'), stops: ['#d73027', '#1a1c7c'] },
      { id: 'viridis', label: t('styleSettings.algorithm.scale.viridis', 'Viridis'), stops: ['#440154', '#21908d', '#fde725'] },
      { id: 'magma', label: t('styleSettings.algorithm.scale.magma', 'Magma'), stops: ['#000004', '#b5367a', '#fbfcbf'] },
      { id: 'custom', label: t('styleSettings.algorithm.scale.custom', 'Custom (HSB)'), stops: [] },
    ],
    [t]
  );

  const renderGradientSwatch = (stops: string[]) => {
    const id = `grad-${Math.random().toString(16).slice(2)}`;
    return (
      <svg width="120" height="16" aria-hidden focusable="false">
        <defs>
          <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="0%">
            {stops.map((c, idx) => (
              <stop key={`${c}-${idx}`} offset={`${(idx / Math.max(stops.length - 1, 1)) * 100}%`} stopColor={c} />
            ))}
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="120" height="16" rx="3" fill={`url(#${id})`} stroke="#ccc" />
      </svg>
    );
  };

  const handlePresetSelect = (id: string) => {
    const preset = presetScales.find((p) => p.id === id);
    if (!preset) return;
    applyConfigPatch({
      colorSpace: 'hsv',
      colorScheme: id,
      startColor: preset.stops[0],
      endColor: preset.stops[preset.stops.length - 1],
    });
  };

  const numericRangeControls = !isColorTarget ? (
    <Stack spacing={1.5}>
      <Typography variant="subtitle2">{t('styleSettings.algorithm.numericRange', 'Numeric range')}</Typography>
      <Stack direction="row" spacing={1}>
        <TextField
          type="number"
          label={t('styleSettings.algorithm.min', 'Min')}
          value={localConfig.min}
          onChange={(e) => applyConfigPatch({ min: Number(e.target.value) })}
          size="small"
          inputProps={{ step: 0.1 }}
        />
        <TextField
          type="number"
          label={t('styleSettings.algorithm.max', 'Max')}
          value={localConfig.max}
          onChange={(e) => applyConfigPatch({ max: Number(e.target.value) })}
          size="small"
          inputProps={{ step: 0.1 }}
        />
      </Stack>
    </Stack>
  ) : null;

  const customHSBControls =
    isColorTarget && (localConfig.colorScheme ?? 'grayscale') === 'custom' ? (
      <Stack spacing={1.5} sx={{ mt: 1 }}>
        <Typography variant="subtitle2">{t('styleSettings.algorithm.customTitle', 'Custom HSB')}</Typography>
        <Stack direction="row" spacing={1}>
          <TextField
            label={t('step5.colorRange.start', 'Start Color (hex)')}
            value={localConfig.startColor ?? ''}
            size="small"
            onChange={(e) => applyConfigPatch({ startColor: e.target.value })}
          />
          <TextField
            label={t('step5.colorRange.end', 'End Color (hex)')}
            value={localConfig.endColor ?? ''}
            size="small"
            onChange={(e) => applyConfigPatch({ endColor: e.target.value })}
          />
        </Stack>
        <Stack spacing={1}>
          <Typography variant="caption">{t('step5.hsv.hueStart', 'Hue Start')}</Typography>
          <Slider value={localConfig.hueStart} onChange={(_e, v) => applyConfigPatch({ hueStart: v as number })} min={0} max={360} />
          <Typography variant="caption">{t('step5.hsv.hueEnd', 'Hue End')}</Typography>
          <Slider value={localConfig.hueEnd} onChange={(_e, v) => applyConfigPatch({ hueEnd: v as number })} min={0} max={360} />
          <Typography variant="caption">{t('step5.hsv.saturation', 'Saturation')}</Typography>
          <Slider value={localConfig.saturation} step={0.05} min={0} max={1} onChange={(_e, v) => applyConfigPatch({ saturation: v as number })} />
          <Typography variant="caption">{t('step5.hsv.brightness', 'Brightness')}</Typography>
          <Slider value={localConfig.brightness} step={0.05} min={0} max={1} onChange={(_e, v) => applyConfigPatch({ brightness: v as number })} />
        </Stack>
        <Box sx={{ height: 32, borderRadius: 1, border: (theme) => `1px solid ${theme.palette.divider}` }}>
          <Box
            sx={{
              height: '100%',
              background: generateColorGradient(localConfig),
              borderRadius: 1,
            }}
          />
        </Box>
      </Stack>
    ) : null;

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
            {t('styleSettings.accordion.algorithm', 'Algorithm')}
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" color="text.secondary">
                {t('styleSettings.algorithm.valueColumn', 'Value column')}
              </Typography>
              <Box sx={{ px: 1.25, py: 0.5, borderRadius: 1, bgcolor: 'action.selected', fontSize: 13 }}>
                {valueColumn || t('styleSettings.algorithm.valueColumnUnset', 'Not selected')}
              </Box>
            </Stack>

            <FormControl component="fieldset">
              <Typography variant="subtitle2" gutterBottom>
                {t('styleSettings.algorithm.nullHandling', 'Null / NaN handling')}
              </Typography>
              <RadioGroup
                row
                value={localConfig.nullHandling ?? 'exclude'}
                onChange={(e) => applyConfigPatch({ nullHandling: e.target.value as 'exclude' | 'zero' })}
              >
                <FormControlLabel value="exclude" control={<Radio />} label={t('styleSettings.algorithm.null.exclude', 'Exclude rows')} />
                <FormControlLabel value="zero" control={<Radio />} label={t('styleSettings.algorithm.null.zero', 'Treat as 0')} />
              </RadioGroup>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel id="algo-select">{t('styleSettings.algorithm.rule', 'Mapping rule')}</InputLabel>
              <Select
                labelId="algo-select"
                label={t('styleSettings.algorithm.rule', 'Mapping rule')}
                value={localConfig.algorithm}
                onChange={(e) => applyConfigPatch({ algorithm: e.target.value as StylerConfig['algorithm'] })}
              >
                <MenuItem value="linear">{t('step5.algorithms.linear', 'Linear')}</MenuItem>
                <MenuItem value="log">{t('step5.algorithms.log', 'Logarithmic')}</MenuItem>
                <MenuItem value="quantile">{t('step5.algorithms.quantile', 'Quantile')}</MenuItem>
                <MenuItem value="jenks">{t('step5.algorithms.jenks', 'Jenks Natural Breaks')}</MenuItem>
                <MenuItem value="equal">{t('step5.algorithms.equal', 'Equal Interval')}</MenuItem>
              </Select>
            </FormControl>

            {isColorTarget ? (
              <Stack spacing={1.5}>
                <Typography variant="subtitle2">
                  {t('styleSettings.algorithm.colorScale', 'Color scale')}
                </Typography>
                <Stack spacing={1}>
                  {presetScales.map((preset) => (
                    <Box
                      key={preset.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        p: 1,
                        borderRadius: 1,
                        border: (theme) =>
                          preset.id === (localConfig.colorScheme ?? 'grayscale')
                            ? `2px solid ${theme.palette.primary.main}`
                            : `1px solid ${theme.palette.divider}`,
                        cursor: 'pointer',
                      }}
                      onClick={() => handlePresetSelect(preset.id)}
                    >
                      {preset.id === 'custom' ? <ContrastIcon fontSize="small" /> : <PaletteIcon fontSize="small" />}
                      <Typography variant="body2" sx={{ flex: 1 }}>
                        {preset.label}
                      </Typography>
                      {preset.stops.length > 0 ? renderGradientSwatch(preset.stops) : null}
                    </Box>
                  ))}
                </Stack>
                {customHSBControls}
              </Stack>
            ) : (
              numericRangeControls
            )}
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Stack>
  );
};
