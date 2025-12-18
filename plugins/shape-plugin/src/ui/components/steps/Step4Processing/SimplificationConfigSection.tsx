import React from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Chip,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import { FilterAlt as FilterAltIcon, ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import type { FeatureFilterMethod, ProcessingConfig, SimplificationProcessingConfig } from '../../../../common/types/index.js';
import { DEFAULT_PROCESSING_CONFIG, mergeProcessingConfig } from '../../../../common/types/index.js';
import { useId } from 'react';
import { WorkerSliderCard } from './common/WorkerSliderCard.js';
import { Slider } from '@mui/material';

type Props = {
  config: ProcessingConfig;
  disabled?: boolean;
  onChange: (next: ProcessingConfig) => void;
};

export const SimplificationConfigSection: React.FC<Props> = ({ config, disabled, onChange }) => {
  const controlId = useId();
  const baseSimplificationConfig: SimplificationProcessingConfig =
    config.simplificationConfig ?? DEFAULT_PROCESSING_CONFIG.simplificationConfig!;

  const update = (partial: Partial<ProcessingConfig>) => {
    onChange(mergeProcessingConfig({ ...config, ...partial }));
  };

  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={2} alignItems="center">
          <FilterAltIcon color="secondary" />
          <Typography variant="subtitle1">Feature Processing (Stage 1)</Typography>
          <Chip
            label={baseSimplificationConfig.enableFiltering ? 'Filtering ON' : 'Filtering OFF'}
            size="small"
            color={baseSimplificationConfig.enableFiltering ? 'success' : 'default'}
            variant="outlined"
          />
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 3 }}>
        <Stack spacing={3}>
          <FormControlLabel
            control={
              <Switch
                checked={baseSimplificationConfig.enableFiltering ?? false}
                onChange={(e) => {
                  const enableFiltering = e.target.checked;
                  update({
                    simplificationConfig: {
                      ...baseSimplificationConfig,
                      enableFiltering,
                    },
                  });
                }}
                disabled={disabled}
                inputProps={{
                  id: `${controlId}-enable-filtering`,
                  name: 'enable-filtering',
                }}
              />
            }
            label="Enable Feature Filtering"
          />

          {baseSimplificationConfig.enableFiltering && (
            <>
              <FormControl component="fieldset">
                <FormLabel component="legend" id={`${controlId}-filtering-method`}>
                  Filtering Method
                </FormLabel>
                <RadioGroup
                  aria-labelledby={`${controlId}-filtering-method`}
                  name="filtering-method"
                  value={baseSimplificationConfig.featureFilterMethod || 'hybrid'}
                  onChange={(e) => {
                    const method = e.target.value as FeatureFilterMethod;
                    update({
                      simplificationConfig: {
                        ...baseSimplificationConfig,
                        featureFilterMethod: method,
                      },
                    });
                  }}
                >
                  <FormControlLabel
                    value="bbox_only"
                    control={<Radio inputProps={{ id: `${controlId}-filtering-bbox-only`, name: 'filtering-method' }} />}
                    label="Bounding Box Only (Fastest)"
                    disabled={disabled}
                    htmlFor={`${controlId}-filtering-bbox-only`}
                  />
                  <FormControlLabel
                    value="polygon_only"
                    control={<Radio inputProps={{ id: `${controlId}-filtering-polygon-only`, name: 'filtering-method' }} />}
                    label="Polygon Only"
                    disabled={disabled}
                    htmlFor={`${controlId}-filtering-polygon-only`}
                  />
                  <FormControlLabel
                    value="hybrid"
                    control={<Radio inputProps={{ id: `${controlId}-filtering-hybrid`, name: 'filtering-method' }} />}
                    label="Hybrid (Recommended)"
                    disabled={disabled}
                    htmlFor={`${controlId}-filtering-hybrid`}
                  />
                </RadioGroup>
              </FormControl>

              <Typography gutterBottom>Minimum Feature Area (sq km)</Typography>
              <Slider
                value={baseSimplificationConfig.areaThreshold ?? 0.1}
                onChange={(_, value) => {
                  const areaThreshold = value as number;
                  update({
                    simplificationConfig: {
                      ...baseSimplificationConfig,
                      areaThreshold,
                    },
                  });
                }}
                min={0}
                max={1}
                step={0.01}
                valueLabelDisplay="auto"
                marks={[{ value: 0, label: '0' }, { value: 0.5, label: '0.5' }, { value: 1, label: '1' }]}
                disabled={disabled}
              />

              <WorkerSliderCard
                title="Simplification Tolerance (meters)"
                value={baseSimplificationConfig.tolerance ?? 0.01}
                min={0.001}
                max={10}
                step={0.001}
                marks={[
                  { value: 0.001, label: '0.001' },
                  { value: 0.1, label: '0.1' },
                  { value: 1, label: '1' },
                  { value: 10, label: '10' },
                ]}
                onChange={(tolerance) =>
                  update({
                    simplificationConfig: {
                      ...baseSimplificationConfig,
                      tolerance,
                    },
                  })
                }
                disabled={disabled}
              />

              <WorkerSliderCard
                title="Simplification Workers (Stage 1)"
                value={baseSimplificationConfig.level1Workers ?? 2}
                onChange={(level1Workers) =>
                  update({
                    simplificationConfig: {
                      ...baseSimplificationConfig,
                      level1Workers,
                    },
                  })
                }
                min={1}
                max={8}
                step={1}
                marks={[
                  { value: 1, label: '1' },
                  { value: 4, label: '4' },
                  { value: 8, label: '8' },
                ]}
                disabled={disabled}
              />

              <WorkerSliderCard
                title="Tile Generation Workers (Stage 2)"
                value={baseSimplificationConfig.level2Workers ?? 2}
                onChange={(level2Workers) =>
                  update({
                    simplificationConfig: {
                      ...baseSimplificationConfig,
                      level2Workers,
                    },
                  })
                }
                min={1}
                max={8}
                step={1}
                marks={[
                  { value: 1, label: '1' },
                  { value: 4, label: '4' },
                  { value: 8, label: '8' },
                ]}
                disabled={disabled}
              />
            </>
          )}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};
