import {
  Box,
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  Grid,
  Radio,
  RadioGroup,
  Slider,
  Stack,
  Typography,
} from '@mui/material';
import type {
  HybridFilterConfig,
  ShapeBuildConfig,
  TransformConfig,
} from '../../../common/types/index.js';
import { useTranslation } from '../../i18n.js';
import { FeatureFilterMethod } from '@hierarchidb/gis-sdk';

type Props = {
  controlId: string;
  baseTransformConfig: TransformConfig;
  baseHybridConfig: HybridFilterConfig;
  quickRejectLogMin: number;
  quickRejectLogMax: number;
  quickRejectLogValue: number;
  disabled?: boolean;
  update: (partial: Partial<ShapeBuildConfig>) => void;
};

export const AreaFilterPanel: React.FC<Props> = ({
  controlId,
  baseTransformConfig,
  baseHybridConfig,
  quickRejectLogMin,
  quickRejectLogMax,
  quickRejectLogValue,
  disabled,
  update,
}) => {
  const { t } = useTranslation();

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2">
        {t('processing.filter.areaFilterTitle', 'Area Filter')}
      </Typography>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Stack spacing={2}>
            <FormControl component="fieldset">
              <FormLabel component="legend" id={`${controlId}-filtering-method`}>
                {t('processing.filter.method', 'Filtering Method')}
              </FormLabel>
              <RadioGroup
                aria-labelledby={`${controlId}-filtering-method`}
                name="filtering-method"
                value={baseTransformConfig.featureFilterMethod}
                onChange={(e) => {
                  const method = e.target.value as FeatureFilterMethod;
                  update({
                    transformConfig: {
                      ...baseTransformConfig,
                      featureFilterMethod: method,
                    },
                  });
                }}
              >
                <FormControlLabel
                  value="none"
                  control={<Radio inputProps={{ id: `${controlId}-filtering-none`, name: 'filtering-method' }} />}
                  label={t('processing.filter.methodNone', 'Filtering Off')}
                  disabled={disabled}
                  htmlFor={`${controlId}-filtering-none`}
                />
                <FormControlLabel
                  value="bbox_only"
                  control={<Radio inputProps={{ id: `${controlId}-filtering-bbox-only`, name: 'filtering-method' }} />}
                  label={t('processing.filter.methodBBox', 'Bounding Box Only (Fastest)')}
                  disabled={disabled}
                  htmlFor={`${controlId}-filtering-bbox-only`}
                />
                <FormControlLabel
                  value="polygon_only"
                  control={<Radio inputProps={{ id: `${controlId}-filtering-polygon-only`, name: 'filtering-method' }} />}
                  label={t('processing.filter.methodPolygon', 'Polygon Only')}
                  disabled={disabled}
                  htmlFor={`${controlId}-filtering-polygon-only`}
                />
                <FormControlLabel
                  value="hybrid"
                  control={<Radio inputProps={{ id: `${controlId}-filtering-hybrid`, name: 'filtering-method' }} />}
                  label={t('processing.filter.methodHybrid', 'Hybrid (Recommended)')}
                  disabled={disabled}
                  htmlFor={`${controlId}-filtering-hybrid`}
                />
              </RadioGroup>
              <FormHelperText>
                {t('processing.filter.methodHelp', 'Controls how features are filtered before extraction.')}
              </FormHelperText>
            </FormControl>
            <div>
              <Typography gutterBottom>
                {t('processing.filter.minVertexCount', 'Min Vertex Count')}
              </Typography>
              <Box sx={{ px: 2 }}>
                <Slider
                  value={baseTransformConfig.minVertexCountForAreaFilter}
                  onChange={(_, value) => {
                    const minVertexCountForAreaFilter = value as number;
                    update({
                      transformConfig: {
                        ...baseTransformConfig,
                        minVertexCountForAreaFilter,
                      },
                    });
                  }}
                  min={0}
                  max={1000}
                  step={1}
                  valueLabelDisplay="auto"
                  marks={[
                    { value: 0, label: '0' },
                    { value: 10, label: '10' },
                    { value: 100, label: '100' },
                    { value: 250, label: '250' },
                    { value: 500, label: '500' },
                    { value: 1000, label: '1000' },
                  ]}
                  track="inverted"
                  disabled={disabled}
                />
              </Box>
              <Typography variant="caption" color="text.secondary">
                {t('processing.filter.minVertexCountHelp', 'Only apply area filtering when feature vertices exceed this count.')}
              </Typography>
            </div>
            <div>
              <Typography gutterBottom>
                {t('processing.filter.minimumArea', 'Minimum Area (sq km)')}
              </Typography>
              <Box sx={{ px: 2 }}>
                <Slider
                  value={baseTransformConfig.featureAreaThreshold}
                  onChange={(_, value) => {
                    const featureAreaThreshold = value as number;
                    update({
                      transformConfig: {
                        ...baseTransformConfig,
                        featureAreaThreshold,
                      },
                    });
                  }}
                  min={0}
                  max={1000}
                  step={1}
                  valueLabelDisplay="auto"
                  marks={[
                    { value: 0, label: '0' },
                    { value: 50, label: '50' },
                    { value: 100, label: '100' },
                    { value: 250, label: '250' },
                    { value: 500, label: '500' },
                    { value: 1000, label: '1000' },
                  ]}
                  track="inverted"
                  disabled={disabled}
                />
              </Box>
              <Typography variant="caption" color="text.secondary">
                {t('processing.filter.minimumAreaHelp', 'Smaller features than this threshold are filtered out early.')}
              </Typography>
            </div>
          </Stack>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Stack spacing={2}>
            <div>
              <Typography gutterBottom>
                {t('processing.filter.quickRejectThreshold', 'Quick Reject Threshold')}
              </Typography>
              <Box sx={{ px: 2 }}>
                <Slider
                  value={quickRejectLogValue}
                  onChange={(_, value) => {
                    const logValue = value as number;
                    const quickRejectThreshold = Number((10 ** logValue).toFixed(3));
                    update({
                      transformConfig: {
                        ...baseTransformConfig,
                        hybridFilterConfig: {
                          ...baseHybridConfig,
                          quickRejectThreshold,
                        },
                      },
                    });
                  }}
                  min={quickRejectLogMin}
                  max={quickRejectLogMax}
                  step={0.1}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(value) => (10 ** Number(value)).toFixed(3)}
                  marks={[
                    { value: Math.log10(0.001), label: '0.001' },
                    { value: Math.log10(0.01), label: '0.01' },
                    { value: Math.log10(0.1), label: '0.1' },
                    { value: Math.log10(1), label: '1' },
                  ]}
                  track="inverted"
                  disabled={disabled}
                />
              </Box>
              <Typography variant="caption" color="text.secondary">
                {t('processing.filter.quickRejectHelp', 'Higher values reject more tiny features quickly.')}
              </Typography>
            </div>
            <div>
              <Typography gutterBottom>
                {t('processing.filter.simpleShapeVertexThreshold', 'Simple Shape Vertex Threshold')}
              </Typography>
              <Box sx={{ px: 2 }}>
                <Slider
                  value={baseHybridConfig.simpleShapeVertexThreshold ?? 10}
                  onChange={(_, value) => {
                    const simpleShapeVertexThreshold = value as number;
                    update({
                      transformConfig: {
                        ...baseTransformConfig,
                        hybridFilterConfig: {
                          ...baseHybridConfig,
                          simpleShapeVertexThreshold,
                        },
                      },
                    });
                  }}
                  min={0}
                  max={500}
                  step={1}
                  valueLabelDisplay="auto"
                  marks={[
                    { value: 0, label: '0' },
                    { value: 100, label: '100' },
                    { value: 300, label: '300' },
                    { value: 500, label: '500' },
                  ]}
                  track="inverted"
                  disabled={disabled}
                />
              </Box>
              <Typography variant="caption" color="text.secondary">
                {t('processing.filter.simpleShapeVertexHelp', 'Vertex count threshold for simple-shape handling.')}
              </Typography>
            </div>
            <div>
              <Typography gutterBottom>
                {t('processing.filter.elongatedShapeCorrectionFactor', 'Elongated Shape Correction Factor')}
              </Typography>
              <Box sx={{ px: 2 }}>
                <Slider
                  value={baseHybridConfig.elongatedShapeCorrectionFactor ?? 0.8}
                  onChange={(_, value) => {
                    const elongatedShapeCorrectionFactor = value as number;
                    update({
                      transformConfig: {
                        ...baseTransformConfig,
                        hybridFilterConfig: {
                          ...baseHybridConfig,
                          elongatedShapeCorrectionFactor,
                        },
                      },
                    });
                  }}
                  min={0.5}
                  max={1.5}
                  step={0.05}
                  valueLabelDisplay="auto"
                  marks={[
                    { value: 0.5, label: '0.5' },
                    { value: 1, label: '1.0' },
                    { value: 1.5, label: '1.5' },
                  ]}
                  disabled={disabled}
                />
              </Box>
              <Typography variant="caption" color="text.secondary">
                {t('processing.filter.elongatedShapeHelp', 'Correction factor for elongated simple shapes.')}
              </Typography>
            </div>
          </Stack>
        </Grid>
      </Grid>
    </Stack>
  );
};
