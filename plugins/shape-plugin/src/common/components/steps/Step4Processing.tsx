import type React from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  FormControl,
  FormControlLabel,
  FormLabel,
  Grid,
  Radio,
  RadioGroup,
  Slider,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import {
  CloudDownload as CloudDownloadIcon,
  ExpandMore as ExpandMoreIcon,
  FilterAlt as FilterAltIcon,
  Layers as LayersIcon,
} from '@mui/icons-material';
import { DEFAULT_PROCESSING_CONFIG, mergeProcessingConfig } from '../../shared/index.js';
import type {
  DownloadProcessingConfig,
  FeatureFilterMethod,
  ProcessingConfig,
  SimplificationProcessingConfig,
  StepProps,
  TileProcessingConfig,
} from '../../shared/index.js';

/**
 * Step 4: Processing Configuration
 * Uses @hierarchidb/ui-accordion-config for processing settings
 */
export const Step4Processing: React.FC<StepProps> = ({ draft, onUpdate, disabled }) => {
  const config = mergeProcessingConfig(draft.processingConfig ?? DEFAULT_PROCESSING_CONFIG);
  const baseDownloadConfig: DownloadProcessingConfig =
    config.downloadConfig ??
    DEFAULT_PROCESSING_CONFIG.downloadConfig ??
    ({ maxConcurrent: config.concurrentDownloads ?? 2 } as DownloadProcessingConfig);
  const baseSimplificationConfig: SimplificationProcessingConfig =
    config.simplificationConfig ??
    DEFAULT_PROCESSING_CONFIG.simplificationConfig ??
    ({
      enableFiltering: config.enableFeatureFiltering ?? false,
      featureFilterMethod: config.featureFilterMethod ?? 'hybrid',
      areaThreshold: config.featureAreaThreshold ?? 0.1,
      level1Workers: config.concurrentProcesses ?? 2,
      level2Workers: config.concurrentProcesses ?? 2,
      tolerance: config.simplificationTolerance ?? 0.01,
    } as SimplificationProcessingConfig);
  const baseTileConfig: TileProcessingConfig =
    config.tileConfig ??
    DEFAULT_PROCESSING_CONFIG.tileConfig ??
    ({ workers: config.concurrentProcesses ?? 2, maxZoom: config.maxZoomLevel ?? 12 } as TileProcessingConfig);

  const applyConfigUpdate = (partial: Partial<ProcessingConfig>) => {
    const next = mergeProcessingConfig({
      ...config,
      ...partial,
    });
    onUpdate({ processingConfig: next });
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Configure Processing Parameters
      </Typography>

      {/* Download Configuration */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Stack direction="row" spacing={2} alignItems="center">
            <CloudDownloadIcon color="primary" />
            <Typography variant="subtitle1">Download Configuration</Typography>
              <Chip
              label={`${config?.downloadConfig?.maxConcurrent ?? config?.concurrentDownloads ?? 2} concurrent`}
              size="small"
              variant="outlined"
            />
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography gutterBottom>Concurrent Downloads</Typography>
              <Slider
                value={baseDownloadConfig.maxConcurrent ?? config.concurrentDownloads ?? 2}
                onChange={(_, value) => {
                  const maxConcurrent = value as number;
                  applyConfigUpdate({
                    concurrentDownloads: maxConcurrent,
                    downloadConfig: {
                      ...baseDownloadConfig,
                      maxConcurrent,
                    },
                  });
                }}
                min={1}
                max={8}
                step={1}
                marks={[
                  { value: 1, label: '1' },
                  { value: 4, label: '4' },
                  { value: 8, label: '8' },
                ]}
                valueLabelDisplay="auto"
                disabled={disabled}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="CORS Proxy Base URL"
                value={config?.corsProxyBaseURL || baseDownloadConfig.corsProxyUrl || ''}
                onChange={(e) => {
                  const corsProxyUrl = e.target.value;
                  applyConfigUpdate({
                    corsProxyBaseURL: corsProxyUrl,
                    downloadConfig: {
                      ...baseDownloadConfig,
                      corsProxyUrl,
                    },
                  });
                }}
                fullWidth
                disabled={disabled}
                placeholder="https://cors-anywhere.herokuapp.com/"
                helperText="Optional proxy for cross-origin requests"
              />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Feature Processing Configuration */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Stack direction="row" spacing={2} alignItems="center">
            <FilterAltIcon color="secondary" />
            <Typography variant="subtitle1">Feature Processing (Stage 1)</Typography>
            <Chip
              label={config?.enableFeatureFiltering ? 'Filtering ON' : 'Filtering OFF'}
              size="small"
              color={config?.enableFeatureFiltering ? 'success' : 'default'}
              variant="outlined"
            />
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={3}>
            <FormControlLabel
              control={
                <Switch
                  checked={baseSimplificationConfig.enableFiltering ?? config.enableFeatureFiltering ?? false}
                  onChange={(e) => {
                    const enableFiltering = e.target.checked;
                    applyConfigUpdate({
                      enableFeatureFiltering: enableFiltering,
                      simplificationConfig: {
                        ...baseSimplificationConfig,
                        enableFiltering,
                      },
                    });
                  }}
                  disabled={disabled}
                />
              }
              label="Enable Feature Filtering"
            />

            {(baseSimplificationConfig.enableFiltering ?? config.enableFeatureFiltering) && (
              <>
                <FormControl component="fieldset">
                  <FormLabel component="legend">Filtering Method</FormLabel>
                  <RadioGroup
                    value={baseSimplificationConfig.featureFilterMethod || config.featureFilterMethod || 'hybrid'}
                    onChange={(e) => {
                      const method = e.target.value as FeatureFilterMethod;
                      applyConfigUpdate({
                        featureFilterMethod: method,
                        simplificationConfig: {
                          ...baseSimplificationConfig,
                          featureFilterMethod: method,
                        },
                      });
                    }}
                  >
                    <FormControlLabel
                      value="bbox_only"
                      control={<Radio />}
                      label="Bounding Box Only (Fastest)"
                      disabled={disabled}
                    />
                    <FormControlLabel
                      value="polygon_only"
                      control={<Radio />}
                      label="Polygon Area Only (Most Accurate)"
                      disabled={disabled}
                    />
                    <FormControlLabel
                      value="hybrid"
                      control={<Radio />}
                      label="Hybrid Method (Balanced)"
                      disabled={disabled}
                    />
                  </RadioGroup>
                </FormControl>

                <Box>
                  <Typography gutterBottom>Feature Area Threshold (%)</Typography>
                  <Slider
                    value={baseSimplificationConfig.areaThreshold ?? config.featureAreaThreshold ?? 0.1}
                    onChange={(_, value) => {
                      const threshold = value as number;
                      applyConfigUpdate({
                        featureAreaThreshold: threshold,
                        simplificationConfig: {
                          ...baseSimplificationConfig,
                          areaThreshold: threshold,
                        },
                      });
                    }}
                    min={0.001}
                    max={10}
                    step={0.001}
                    valueLabelFormat={(value) => `${value}%`}
                    valueLabelDisplay="auto"
                    disabled={disabled}
                  />
                </Box>
              </>
            )}
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Vector Tile Configuration */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Stack direction="row" spacing={2} alignItems="center">
            <LayersIcon color="success" />
            <Typography variant="subtitle1">Vector Tile Generation</Typography>
            <Chip
              label={`${baseTileConfig.workers ?? config.concurrentProcesses ?? 2} concurrent`}
              size="small"
              variant="outlined"
            />
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Concurrent Processes"
                type="number"
                value={baseTileConfig.workers ?? config.concurrentProcesses ?? 2}
                onChange={(e) => {
                  const workers = parseInt(e.target.value) || 2;
                  applyConfigUpdate({
                    concurrentProcesses: workers,
                    tileConfig: {
                      ...baseTileConfig,
                      workers,
                    },
                  });
                }}
                inputProps={{ min: 1, max: 8 }}
                fullWidth
                disabled={disabled}
                helperText="Number of simultaneous tile processors (1-8)"
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Max Zoom Level"
                type="number"
                value={baseTileConfig.maxZoom ?? config.maxZoomLevel ?? 12}
                onChange={(e) => {
                  const maxZoom = parseInt(e.target.value) || 12;
                  applyConfigUpdate({
                    maxZoomLevel: maxZoom,
                    tileConfig: {
                      ...baseTileConfig,
                      maxZoom,
                    },
                  });
                }}
                inputProps={{ min: 8, max: 18 }}
                fullWidth
                disabled={disabled}
                helperText="Maximum zoom level for vector tiles (8-18)"
              />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};
