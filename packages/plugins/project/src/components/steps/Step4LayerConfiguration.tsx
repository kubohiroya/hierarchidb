/**
 * Project Dialog - Step 4: Layer Configuration
 * Configure display properties for each selected resource
 */

import React, { useEffect, useCallback, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,

  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField,
  Slider,
  FormControlLabel,
  Switch,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  IconButton,
  Divider,
  Alert,
  Button,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Settings as SettingsIcon,
  Layers as LayersIcon,
} from '@mui/icons-material';
import type { NodeId } from '@hierarchidb/00-core';
import type { CreateProjectData, LayerConfiguration, LayerType } from '../../types';

/**
 * Props for Step4LayerConfiguration
 */
export interface Step4LayerConfigurationProps {
  data: Partial<CreateProjectData>;
  onChange: (updates: Partial<CreateProjectData>) => void;
}

/**
 * Default layer configuration
 */
const createDefaultLayerConfig = (resourceId: NodeId, index: number): LayerConfiguration => ({
  layerId: `layer-${resourceId}-${index}`,
  layerType: 'raster' as LayerType,
  layerOrder: index,
  isVisible: true,
  opacity: 1.0,
  styleConfig: {
    source: {
      type: 'raster',
      url: '',
      attribution: '',
    },
  },
  interactionConfig: {
    clickable: true,
    hoverable: true,
  },
  visibilityRules: {
    minZoom: 0,
    maxZoom: 22,
  },
});

/**
 * Step 4: Layer Configuration Component
 */
export const Step4LayerConfiguration: React.FC<Step4LayerConfigurationProps> = ({
  data,
  onChange,
}) => {
  const [expandedLayers, setExpandedLayers] = useState<Set<string>>(new Set());

  // Get current references and layer configurations
  const currentReferences = data.initialReferences || [];
  const [layerConfigs, setLayerConfigs] = useState<Record<string, LayerConfiguration>>(() => {
    // Initialize layer configurations for all references
    const configs: Record<string, LayerConfiguration> = {};
    currentReferences.forEach((resourceId, index) => {
      configs[resourceId] = createDefaultLayerConfig(resourceId, index);
    });
    return configs;
  });

  /**
   * Handle layer configuration change
   */
  const handleLayerConfigChange = useCallback((resourceId: NodeId, updates: Partial<LayerConfiguration>) => {
    setLayerConfigs(prev => ({
      ...prev,
      [resourceId]: {
        ...prev[resourceId],
        ...updates,
      } as LayerConfiguration,
    }));
  }, []);

  /**
   * Handle accordion expand/collapse
   */
  const handleAccordionToggle = useCallback((resourceId: string) => {
    setExpandedLayers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(resourceId)) {
        newSet.delete(resourceId);
      } else {
        newSet.add(resourceId);
      }
      return newSet;
    });
  }, []);

  /**
   * Handle layer visibility toggle
   */
  const handleVisibilityToggle = useCallback((resourceId: NodeId) => {
    const currentConfig = layerConfigs[resourceId];
    handleLayerConfigChange(resourceId, {
      isVisible: !currentConfig?.isVisible,
    });
  }, [layerConfigs, handleLayerConfigChange]);

  /**
   * Handle layer order change
   */
  const handleLayerOrderChange = useCallback((resourceId: NodeId, newOrder: number) => {
    handleLayerConfigChange(resourceId, {
      layerOrder: newOrder,
    });
  }, [handleLayerConfigChange]);

  /**
   * Handle opacity change
   */
  const handleOpacityChange = useCallback((resourceId: NodeId, opacity: number) => {
    handleLayerConfigChange(resourceId, {
      opacity: opacity / 100, // Convert percentage to decimal
    });
  }, [handleLayerConfigChange]);

  /**
   * Handle layer type change
   */
  const handleLayerTypeChange = useCallback((resourceId: NodeId, layerType: LayerType) => {
    handleLayerConfigChange(resourceId, {
      layerType,
    });
  }, [handleLayerConfigChange]);

  /**
   * Apply all configurations
   */
  const applyConfigurations = useCallback(() => {
    // Convert layer configurations to the format expected by ProjectEntity
    const projectLayerConfigs: Record<string, LayerConfiguration> = {};
    Object.entries(layerConfigs).forEach(([resourceId, config]) => {
      projectLayerConfigs[resourceId] = config;
    });

    onChange({
      layerConfigurations: projectLayerConfigs,
    });
  }, [layerConfigs, onChange]);

  // Apply configurations whenever they change
  useEffect(() => {
    applyConfigurations();
  }, [applyConfigurations]);

  if (currentReferences.length === 0) {
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Layer Configuration
        </Typography>
        <Alert severity="info">
          No resources selected in the previous step. 
          Go back to add some resources before configuring layers.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Layer Configuration
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Configure how each selected resource will appear as a layer on your map. 
        You can adjust visibility, opacity, display order, and other properties.
      </Typography>

      {/* Layer List */}
      <Card variant="outlined">
        <CardContent>
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <LayersIcon color="primary" />
            <Typography variant="subtitle1">
              Layer Stack ({currentReferences.length} layers)
            </Typography>
          </Box>

          <Typography variant="body2" color="text.secondary" mb={2}>
            Layers are rendered from bottom to top. Drag to reorder or use the order controls.
          </Typography>

          {currentReferences.map((resourceId, index) => {
            const layerConfig = layerConfigs[resourceId];
            const isExpanded = expandedLayers.has(resourceId);

            return (
              <Accordion
                key={resourceId}
                expanded={isExpanded}
                onChange={() => handleAccordionToggle(resourceId)}
                sx={{ mb: 1 }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box display="flex" alignItems="center" gap={2} width="100%">
                    {/* Visibility Toggle */}
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleVisibilityToggle(resourceId);
                      }}
                      color={layerConfig?.isVisible ? 'primary' : 'default'}
                    >
                      {layerConfig?.isVisible ? <VisibilityIcon /> : <VisibilityOffIcon />}
                    </IconButton>

                    {/* Layer Info */}
                    <Box flexGrow={1}>
                      <Typography variant="subtitle2">
                        Layer {index + 1}: Resource {resourceId}
                      </Typography>
                      <Box display="flex" gap={1} mt={0.5}>
                        <Chip
                          label={layerConfig?.layerType || 'raster'}
                          size="small"
                          variant="outlined"
                        />
                        <Chip
                          label={`${Math.round((layerConfig?.opacity || 1) * 100)}% opacity`}
                          size="small"
                          variant="outlined"
                        />
                        <Chip
                          label={`Order: ${layerConfig?.layerOrder || index}`}
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                    </Box>

                    {/* Settings Icon */}
                    <SettingsIcon color="action" />
                  </Box>
                </AccordionSummary>

                <AccordionDetails>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {/* Basic Settings */}
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        Basic Settings
                      </Typography>
                    </Box>

                    {/* Layer Type and Order Row */}
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      <Box sx={{ flex: '1 1 300px', minWidth: '200px' }}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Layer Type</InputLabel>
                          <Select
                            value={layerConfig?.layerType || 'raster'}
                            onChange={(e) => handleLayerTypeChange(resourceId, e.target.value as LayerType)}
                            label="Layer Type"
                          >
                            <MenuItem value="raster">Raster Tiles</MenuItem>
                            <MenuItem value="vector">Vector Tiles</MenuItem>
                            <MenuItem value="geojson">GeoJSON</MenuItem>
                            <MenuItem value="image">Static Image</MenuItem>
                          </Select>
                        </FormControl>
                      </Box>

                      <Box sx={{ flex: '1 1 300px', minWidth: '200px' }}>
                        <TextField
                          label="Display Order"
                          type="number"
                          size="small"
                          fullWidth
                          value={layerConfig?.layerOrder || index}
                          onChange={(e) => handleLayerOrderChange(resourceId, parseInt(e.target.value) || index)}
                          inputProps={{ min: 0, max: 100 }}
                          helperText="Higher numbers appear on top"
                        />
                      </Box>
                    </Box>

                    {/* Opacity */}
                    <Box>
                      <Typography variant="body2" gutterBottom>
                        Opacity: {Math.round((layerConfig?.opacity || 1) * 100)}%
                      </Typography>
                      <Slider
                        value={(layerConfig?.opacity || 1) * 100}
                        onChange={(_, value) => handleOpacityChange(resourceId, value as number)}
                        min={0}
                        max={100}
                        step={5}
                        marks={[
                          { value: 0, label: 'Transparent' },
                          { value: 50, label: '50%' },
                          { value: 100, label: 'Opaque' },
                        ]}
                        valueLabelDisplay="auto"
                        valueLabelFormat={(value) => `${value}%`}
                      />
                    </Box>

                    <Box>
                      <Divider sx={{ my: 1 }} />
                      <Typography variant="subtitle2" gutterBottom>
                        Interaction Settings
                      </Typography>
                    </Box>

                    {/* Interaction Controls Row */}
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      <Box sx={{ flex: '1 1 200px' }}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={layerConfig?.interactionConfig?.clickable ?? true}
                              onChange={(e) => {
                                handleLayerConfigChange(resourceId, {
                                  interactionConfig: {
                                    clickable: e.target.checked,
                                    hoverable: layerConfig?.interactionConfig?.hoverable ?? true,
                                    popupTemplate: layerConfig?.interactionConfig?.popupTemplate || '',
                                    tooltipTemplate: layerConfig?.interactionConfig?.tooltipTemplate || '',
                                  },
                                });
                              }}
                            />
                          }
                          label="Clickable"
                        />
                      </Box>

                      <Box sx={{ flex: '1 1 200px' }}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={layerConfig?.interactionConfig?.hoverable ?? true}
                              onChange={(e) => {
                                handleLayerConfigChange(resourceId, {
                                  interactionConfig: {
                                    clickable: layerConfig?.interactionConfig?.clickable ?? true,
                                    hoverable: e.target.checked,
                                    popupTemplate: layerConfig?.interactionConfig?.popupTemplate || '',
                                    tooltipTemplate: layerConfig?.interactionConfig?.tooltipTemplate || '',
                                  },
                                });
                              }}
                            />
                          }
                          label="Hoverable"
                        />
                      </Box>
                    </Box>

                    <Box>
                      <Divider sx={{ my: 1 }} />
                      <Typography variant="subtitle2" gutterBottom>
                        Visibility Rules
                      </Typography>
                    </Box>

                    {/* Zoom Controls Row */}
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      <Box sx={{ flex: '1 1 200px' }}>
                        <TextField
                          label="Minimum Zoom"
                          type="number"
                          size="small"
                          fullWidth
                          value={layerConfig?.visibilityRules?.minZoom || 0}
                          onChange={(e) => {
                            const minZoom = parseInt(e.target.value) || 0;
                            handleLayerConfigChange(resourceId, {
                              visibilityRules: {
                                ...layerConfig?.visibilityRules,
                                minZoom,
                              },
                            });
                          }}
                          inputProps={{ min: 0, max: 22 }}
                          helperText="Layer visible from this zoom level"
                        />
                      </Box>

                      <Box sx={{ flex: '1 1 200px' }}>
                        <TextField
                          label="Maximum Zoom"
                          type="number"
                          size="small"
                          fullWidth
                          value={layerConfig?.visibilityRules?.maxZoom || 22}
                          onChange={(e) => {
                            const maxZoom = parseInt(e.target.value) || 22;
                            handleLayerConfigChange(resourceId, {
                              visibilityRules: {
                                ...layerConfig?.visibilityRules,
                                maxZoom,
                              },
                            });
                          }}
                          inputProps={{ min: 0, max: 22 }}
                          helperText="Layer visible up to this zoom level"
                        />
                      </Box>
                    </Box>
                  </Box>
                </AccordionDetails>
              </Accordion>
            );
          })}

          {/* Reset Button */}
          <Box mt={2} textAlign="center">
            <Button
              variant="outlined"
              size="small"
              onClick={() => {
                // Reset all configurations to defaults
                const resetConfigs: Record<string, LayerConfiguration> = {};
                currentReferences.forEach((resourceId, index) => {
                  resetConfigs[resourceId] = createDefaultLayerConfig(resourceId, index);
                });
                setLayerConfigs(resetConfigs);
              }}
            >
              Reset All to Defaults
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Summary */}
      <Box mt={3}>
        <Alert severity="success">
          Layer configurations will be applied to your project. 
          You can always modify these settings later through the project editor.
        </Alert>
      </Box>
    </Box>
  );
};

export default Step4LayerConfiguration;