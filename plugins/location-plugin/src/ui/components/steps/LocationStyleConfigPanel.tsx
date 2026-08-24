/**
 * Style configuration panel for Location preview.
 */

import type { SvgIconComponent } from '@mui/icons-material';
import { Anchor, FlightTakeoff, ForkRight, LocationCity, Subway } from '@mui/icons-material';
import {
  Box,
  Card,
  CardContent,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Slider,
  TextField,
  Typography,
} from '@mui/material';
import type React from 'react';
import type { LocationEntity } from '~/common/types/index';
import type { LocationIconId, LocationType } from '~/common/entities/LocationEntity';
import { useLocationStyleConfigPanel } from './useLocationStyleConfigPanel.ts';

interface LocationStyleConfigPanelProps {
  draft: Partial<LocationEntity>;
  onUpdate?: (updates: Partial<LocationEntity>) => void;
  disabled?: boolean;
}

const MIN_ZOOM_LEVEL = 0;
const LOCATION_TYPES: LocationType[] = [
  'area_centroid',
  'airport',
  'port',
  'railway_station',
  'interchange',
];

const ICON_OPTIONS: Array<{ id: LocationIconId; Icon: SvgIconComponent; labelKey: string }> = [
  { id: 'location_city', Icon: LocationCity, labelKey: 'location_city' },
  { id: 'flight_takeoff', Icon: FlightTakeoff, labelKey: 'flight_takeoff' },
  { id: 'directions_boat', Icon: Anchor, labelKey: 'directions_boat' },
  { id: 'train', Icon: Subway, labelKey: 'train' },
  { id: 'fork_right', Icon: ForkRight, labelKey: 'fork_right' },
];

const DEFAULT_ICON_SIZE_RANGE: [number, number] = [2, 8];
const DEFAULT_LABEL_SIZE_RANGE: [number, number] = [2, 6];

const MIN_ICON_SIZE = 0;
const MAX_ICON_SIZE = 12;
const MIN_LABEL_SIZE = 0;
const MAX_LABEL_SIZE = 12;

const sliderSx = { ml: 3, mr: 0, width: 'calc(100% - 24px)' };
const sliderContainerSx = { m: 2 };

const clamp = (value: number, min: number, max: number): number => {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
};

const normalizeRange = (value: number[] | number, min: number, max: number): [number, number] => {
  const array = Array.isArray(value) ? value : [value, value];
  const first = clamp(Number(array[0] ?? min), min, max);
  const second = clamp(Number(array[1] ?? first), min, max);
  return first <= second ? [first, second] : [second, first];
};

const normalizeZoomStops = (
  values: number[],
  maxZoom: number
): [number, number, number, number] => {
  const clamped = values.map((value) => clamp(Math.round(value), MIN_ZOOM_LEVEL, maxZoom));
  const normalized: number[] = [];
  let last = MIN_ZOOM_LEVEL;
  for (let index = 0; index < 4; index += 1) {
    const next = clamp(clamped[index] ?? last, last, maxZoom);
    normalized.push(next);
    last = next;
  }
  return normalized as [number, number, number, number];
};

export const LocationStyleConfigPanel: React.FC<LocationStyleConfigPanelProps> = ({
  draft: draftProp,
  onUpdate,
  disabled,
}) => {
  const { t, tilesMaxZoom, representationConfig, iconConfig, labelConfig } =
    useLocationStyleConfigPanel(draftProp, onUpdate);

  const handleRepresentationChange = (type: LocationType, value: number | number[]) => {
    if (!Array.isArray(value)) return;
    const stops = normalizeZoomStops(value, tilesMaxZoom);
    const next = {
      ...representationConfig,
      [type]: {
        pointFromZoom: stops[0],
        polygonFromZoom: stops[1],
        iconFromZoom: stops[2],
        iconFixedFromZoom: stops[3],
      },
    };
    onUpdate?.({ representationByZoomLevelConfig: next });
  };

  const handleIconColorChange = (type: LocationType, value: string) => {
    const next = {
      ...iconConfig,
      [type]: {
        ...iconConfig[type],
        color: value,
      },
    };
    onUpdate?.({ iconConfig: next });
  };

  const handleIconIdChange = (type: LocationType, value: LocationIconId) => {
    const next = {
      ...iconConfig,
      [type]: {
        ...iconConfig[type],
        iconId: value,
      },
    };
    onUpdate?.({ iconConfig: next });
  };

  const handleIconSizeRangeChange = (type: LocationType, value: number | number[]) => {
    const range = normalizeRange(value, MIN_ICON_SIZE, MAX_ICON_SIZE);
    const next = {
      ...iconConfig,
      [type]: {
        ...iconConfig[type],
        sizeRange: range,
      },
    };
    onUpdate?.({ iconConfig: next });
  };

  const handleLabelColorChange = (type: LocationType, value: string) => {
    const next = {
      ...labelConfig,
      [type]: {
        ...labelConfig[type],
        color: value,
      },
    };
    onUpdate?.({ labelConfig: next });
  };

  const handleLabelZoomRangeChange = (type: LocationType, value: number | number[]) => {
    const range = normalizeRange(value, MIN_ZOOM_LEVEL, tilesMaxZoom);
    const next = {
      ...labelConfig,
      [type]: {
        ...labelConfig[type],
        zoomRange: range,
      },
    };
    onUpdate?.({ labelConfig: next });
  };

  const handleLabelSizeRangeChange = (type: LocationType, value: number | number[]) => {
    const range = normalizeRange(value, MIN_LABEL_SIZE, MAX_LABEL_SIZE);
    const next = {
      ...labelConfig,
      [type]: {
        ...labelConfig[type],
        sizeRange: range,
      },
    };
    onUpdate?.({ labelConfig: next });
  };

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      <Box display="flex" flexDirection="column" gap={2}>
        <Typography variant="subtitle1">
          {t('processing.displayConfig.title', 'Display Settings')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t(
            'processing.displayConfig.description',
            'Configure representation, icon, and label settings for each location type.'
          )}
        </Typography>

        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1">
              {t('processing.displayConfig.representation.title', 'Representation by Zoom Level')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t(
                'processing.displayConfig.representation.description',
                'Adjust when points, polygons, and icons appear as you zoom.'
              )}
            </Typography>
            <Grid container spacing={2} columns={{ xs: 12 }} sx={sliderContainerSx}>
              {LOCATION_TYPES.map((type) => {
                const entry = representationConfig[type];
                const value = [
                  entry.pointFromZoom,
                  entry.polygonFromZoom,
                  entry.iconFromZoom,
                  entry.iconFixedFromZoom,
                ];
                return (
                  <Grid key={`representation-${type}`} size={{ xs: 12, md: 6 }}>
                    <Typography variant="subtitle2">{t(`locationTypes.${type}`, type)}</Typography>
                    <Slider
                      min={MIN_ZOOM_LEVEL}
                      max={tilesMaxZoom}
                      step={1}
                      marks={[
                        { value: MIN_ZOOM_LEVEL, label: String(MIN_ZOOM_LEVEL) },
                        { value: tilesMaxZoom, label: String(tilesMaxZoom) },
                      ]}
                      sx={sliderSx}
                      value={value}
                      valueLabelDisplay="auto"
                      onChange={(_, next) => handleRepresentationChange(type, next)}
                      disabled={disabled}
                    />
                  </Grid>
                );
              })}
            </Grid>
            <Box mt={1} display="flex" flexDirection="column" gap={0.5}>
              <Typography variant="caption">
                {t(
                  'processing.displayConfig.representation.pointLabel',
                  'Point rendering (1px) starts from this zoom.'
                )}
              </Typography>
              <Typography variant="caption">
                {t(
                  'processing.displayConfig.representation.polygonLabel',
                  'Scaled polygon rendering starts from this zoom.'
                )}
              </Typography>
              <Typography variant="caption">
                {t(
                  'processing.displayConfig.representation.iconLabel',
                  'Scaled SVG icon rendering starts from this zoom.'
                )}
              </Typography>
              <Typography variant="caption">
                {t(
                  'processing.displayConfig.representation.iconFixedLabel',
                  'Icons stop scaling and become fixed size from this zoom.'
                )}
              </Typography>
            </Box>
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1">
              {t('processing.displayConfig.icon.title', 'Icon Settings')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t(
                'processing.displayConfig.icon.description',
                'Configure icon colors, symbols, and size range.'
              )}
            </Typography>
            <Grid container spacing={2} columns={{ xs: 12 }} sx={sliderContainerSx}>
              {LOCATION_TYPES.map((type) => {
                const entry = iconConfig[type];
                const range = entry.sizeRange ?? DEFAULT_ICON_SIZE_RANGE;
                const labelId = `icon-select-${type}`;
                return (
                  <Grid key={`icon-${type}`} size={{ xs: 12 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      {t(`locationTypes.${type}`, type)}
                    </Typography>
                    <Grid container spacing={2} columns={{ xs: 12 }} sx={sliderContainerSx}>
                      <Grid size={{ xs: 12, md: 3 }}>
                        <TextField
                          type="color"
                          label={t('processing.displayConfig.icon.colorLabel', 'Icon color')}
                          value={entry.color}
                          onChange={(event) => handleIconColorChange(type, event.target.value)}
                          fullWidth
                          disabled={disabled}
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 4 }}>
                        <FormControl fullWidth disabled={disabled}>
                          <InputLabel id={labelId}>
                            {t('processing.displayConfig.icon.iconLabel', 'Icon')}
                          </InputLabel>
                          <Select
                            labelId={labelId}
                            value={entry.iconId}
                            label={t('processing.displayConfig.icon.iconLabel', 'Icon')}
                            onChange={(event) =>
                              handleIconIdChange(type, event.target.value as LocationIconId)
                            }
                          >
                            {ICON_OPTIONS.map((option) => {
                              const Icon = option.Icon;
                              const iconLabel = t(
                                `processing.displayConfig.icon.options.${option.labelKey}`,
                                option.labelKey
                              );
                              return (
                                <MenuItem key={option.id} value={option.id}>
                                  <Box display="flex" alignItems="center" gap={1}>
                                    <Icon fontSize="small" />
                                    <span>{iconLabel}</span>
                                  </Box>
                                </MenuItem>
                              );
                            })}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid size={{ xs: 12, md: 5 }}>
                        <Typography gutterBottom>
                          {t('processing.displayConfig.icon.sizeLabel', 'Icon size range')}
                        </Typography>
                        <Slider
                          min={MIN_ICON_SIZE}
                          max={MAX_ICON_SIZE}
                          step={1}
                          marks={[
                            { value: 0, label: '0' },
                            { value: 12, label: '12' },
                          ]}
                          sx={sliderSx}
                          value={range}
                          valueLabelDisplay="auto"
                          onChange={(_, next) => handleIconSizeRangeChange(type, next)}
                          disabled={disabled}
                        />
                      </Grid>
                    </Grid>
                  </Grid>
                );
              })}
            </Grid>
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1">
              {t('processing.displayConfig.label.title', 'Label Settings')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t(
                'processing.displayConfig.label.description',
                'Configure label colors, size range, and zoom thresholds.'
              )}
            </Typography>
            <Grid container spacing={2} columns={{ xs: 12 }} sx={sliderContainerSx}>
              {LOCATION_TYPES.map((type) => {
                const entry = labelConfig[type];
                const zoomRange =
                  entry.zoomRange ??
                  normalizeRange([0, tilesMaxZoom], MIN_ZOOM_LEVEL, tilesMaxZoom);
                const sizeRange = entry.sizeRange ?? DEFAULT_LABEL_SIZE_RANGE;
                return (
                  <Grid key={`label-${type}`} size={{ xs: 12 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      {t(`locationTypes.${type}`, type)}
                    </Typography>
                    <Grid container spacing={2} columns={{ xs: 12 }} sx={sliderContainerSx}>
                      <Grid size={{ xs: 12, md: 3 }}>
                        <TextField
                          type="color"
                          label={t('processing.displayConfig.label.colorLabel', 'Label color')}
                          value={entry.color}
                          onChange={(event) => handleLabelColorChange(type, event.target.value)}
                          fullWidth
                          disabled={disabled}
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 4 }}>
                        <Typography gutterBottom>
                          {t('processing.displayConfig.label.zoomRangeLabel', 'Label zoom range')}
                        </Typography>
                        <Slider
                          min={MIN_ZOOM_LEVEL}
                          max={tilesMaxZoom}
                          step={1}
                          sx={sliderSx}
                          value={zoomRange}
                          valueLabelDisplay="auto"
                          onChange={(_, next) => handleLabelZoomRangeChange(type, next)}
                          disabled={disabled}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 5 }}>
                        <Typography gutterBottom>
                          {t('processing.displayConfig.label.sizeLabel', 'Label size range')}
                        </Typography>
                        <Slider
                          min={MIN_LABEL_SIZE}
                          max={MAX_LABEL_SIZE}
                          step={1}
                          marks={[
                            { value: 0, label: '0' },
                            { value: 12, label: '12' },
                          ]}
                          sx={sliderSx}
                          value={sizeRange}
                          valueLabelDisplay="auto"
                          onChange={(_, next) => handleLabelSizeRangeChange(type, next)}
                          disabled={disabled}
                        />
                      </Grid>
                    </Grid>
                  </Grid>
                );
              })}
            </Grid>
            <Box mt={1} display="flex" flexDirection="column" gap={0.5}>
              <Typography variant="caption">
                {t(
                  'processing.displayConfig.label.zoomStartLabel',
                  'Scaled label rendering starts from the first zoom value.'
                )}
              </Typography>
              <Typography variant="caption">
                {t(
                  'processing.displayConfig.label.zoomFixedLabel',
                  'Labels become fixed size from the second zoom value.'
                )}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};
