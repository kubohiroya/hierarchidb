import React from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  Slider,
  TextField,
  Stack,
  Chip,
  FormControlLabel,
  Switch,
  FormControl,
  FormLabel,
  RadioGroup,
  Radio,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  CloudDownload as CloudDownloadIcon,
  FilterAlt as FilterAltIcon,
  Layers as LayersIcon,
} from '@mui/icons-material';
import type { StepProps, FeatureFilterMethod } from '~/types';

/**
 * Step 4: Processing Configuration
 * Uses @hierarchidb/ui-accordion-config for processing settings
 */
export const Step4Processing: React.FC<StepProps> = ({ workingCopy, onUpdate, disabled }) => {
  const config = workingCopy.processingConfig;

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
              label={`${config?.concurrentDownloads || 2} concurrent`}
              size="small" 
              variant="outlined"
            />
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <Typography gutterBottom>Concurrent Downloads</Typography>
              <Slider
                value={config?.concurrentDownloads || 2}
                onChange={(_, value) => onUpdate({
                  processingConfig: {
                    ...config,
                    concurrentDownloads: value as number
                  }
                })}
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
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="CORS Proxy Base URL"
                value={config?.corsProxyBaseURL || ''}
                onChange={(e) => onUpdate({
                  processingConfig: {
                    ...config,
                    corsProxyBaseURL: e.target.value
                  }
                })}
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
                  checked={config?.enableFeatureFiltering || false}
                  onChange={(e) => onUpdate({
                    processingConfig: {
                      ...config,
                      enableFeatureFiltering: e.target.checked
                    }
                  })}
                  disabled={disabled}
                />
              }
              label="Enable Feature Filtering"
            />
            
            {config?.enableFeatureFiltering && (
              <>
                <FormControl component="fieldset">
                  <FormLabel component="legend">Filtering Method</FormLabel>
                  <RadioGroup
                    value={config?.featureFilterMethod || 'hybrid'}
                    onChange={(e) => onUpdate({
                      processingConfig: {
                        ...config,
                        featureFilterMethod: e.target.value as FeatureFilterMethod
                      }
                    })}
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
                    value={config?.featureAreaThreshold || 0.1}
                    onChange={(_, value) => onUpdate({
                      processingConfig: {
                        ...config,
                        featureAreaThreshold: value as number
                      }
                    })}
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
              label={`${config?.concurrentProcesses || 2} concurrent`}
              size="small" 
              variant="outlined"
            />
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Concurrent Processes"
                type="number"
                value={config?.concurrentProcesses || 2}
                onChange={(e) => onUpdate({
                  processingConfig: {
                    ...config,
                    concurrentProcesses: parseInt(e.target.value) || 2
                  }
                })}
                inputProps={{ min: 1, max: 8 }}
                fullWidth
                disabled={disabled}
                helperText="Number of simultaneous tile processors (1-8)"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Max Zoom Level"
                type="number"
                value={config?.maxZoomLevel || 12}
                onChange={(e) => onUpdate({
                  processingConfig: {
                    ...config,
                    maxZoomLevel: parseInt(e.target.value) || 12
                  }
                })}
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