import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Adjust as BufferIcon,
  BubbleChart as ClusterIcon,
  Delete as DeleteIcon,
  Gradient as DensityIcon,
  Info as InfoIcon,
  Layers as IntersectionIcon,
  NearMe as NearestIcon,
  PlayArrow as PlayIcon,
  Route as NetworkIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import type { ProjectEntity, SpatialAnalysis, SpatialAnalysisType } from '~/types/project-types';

interface SpatialAnalysisStepProps {
  data: Partial<ProjectEntity>;
  onComplete: (data: Partial<ProjectEntity>) => void;
}

const analysisTypes: Array<{
  type: SpatialAnalysisType;
  name: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    type: 'buffer',
    name: 'Buffer Analysis',
    description: 'Create buffer zones around features',
    icon: <BufferIcon />,
  },
  {
    type: 'intersection',
    name: 'Intersection',
    description: 'Find overlapping areas between layers',
    icon: <IntersectionIcon />,
  },
  {
    type: 'nearest',
    name: 'Nearest Neighbor',
    description: 'Find closest features between layers',
    icon: <NearestIcon />,
  },
  {
    type: 'cluster',
    name: 'Cluster Analysis',
    description: 'Group features based on spatial proximity',
    icon: <ClusterIcon />,
  },
  {
    type: 'density',
    name: 'Density Analysis',
    description: 'Calculate feature density across the area',
    icon: <DensityIcon />,
  },
  {
    type: 'network',
    name: 'Network Analysis',
    description: 'Analyze connectivity and paths',
    icon: <NetworkIcon />,
  },
];

interface AnalysisConfigPanelProps {
  analysis: SpatialAnalysis;
  layers: string[];
  onChange: (analysis: SpatialAnalysis) => void;
  onDelete: () => void;
}

const AnalysisConfigPanel: React.FC<AnalysisConfigPanelProps> = ({
                                                                   analysis,
                                                                   layers,
                                                                   onChange,
                                                                   onDelete,
                                                                 }) => {
  const renderConfig = () => {
    switch (analysis.type) {
      case 'buffer':
        return (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Source Layer</InputLabel>
                <Select
                  value={analysis.buffer?.sourceLayer || ''}
                  onChange={(e) =>
                    onChange({
                      ...analysis,
                      buffer: { ...analysis.buffer!, sourceLayer: e.target.value },
                    })
                  }
                  label="Source Layer"
                >
                  {layers.map((layer) => (
                    <MenuItem key={layer} value={layer}>
                      {layer}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                size="small"
                label="Distance"
                type="number"
                value={analysis.buffer?.distance || 100}
                onChange={(e) =>
                  onChange({
                    ...analysis,
                    buffer: { ...analysis.buffer!, distance: parseFloat(e.target.value) },
                  })
                }
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Unit</InputLabel>
                <Select
                  value={analysis.buffer?.unit || 'meters'}
                  onChange={(e) =>
                    onChange({
                      ...analysis,
                      buffer: { ...analysis.buffer!, unit: e.target.value as any },
                    })
                  }
                  label="Unit"
                >
                  <MenuItem value="meters">Meters</MenuItem>
                  <MenuItem value="kilometers">Kilometers</MenuItem>
                  <MenuItem value="miles">Miles</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={analysis.buffer?.dissolve || false}
                    onChange={(e) =>
                      onChange({
                        ...analysis,
                        buffer: { ...analysis.buffer!, dissolve: e.target.checked },
                      })
                    }
                  />
                }
                label="Dissolve boundaries"
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>End Cap</InputLabel>
                <Select value={analysis.buffer?.endCap || 'round'} label="End Cap">
                  <MenuItem value="round">Round</MenuItem>
                  <MenuItem value="flat">Flat</MenuItem>
                  <MenuItem value="square">Square</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        );

      case 'intersection':
        return (
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Layer 1</InputLabel>
                <Select value={analysis.intersection?.layer1 || ''} label="Layer 1">
                  {layers.map((layer) => (
                    <MenuItem key={layer} value={layer}>
                      {layer}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Layer 2</InputLabel>
                <Select value={analysis.intersection?.layer2 || ''} label="Layer 2">
                  {layers.map((layer) => (
                    <MenuItem key={layer} value={layer}>
                      {layer}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Spatial Relation</InputLabel>
                <Select
                  value={analysis.intersection?.spatialRelation || 'intersects'}
                  label="Spatial Relation"
                >
                  <MenuItem value="intersects">Intersects</MenuItem>
                  <MenuItem value="contains">Contains</MenuItem>
                  <MenuItem value="within">Within</MenuItem>
                  <MenuItem value="overlaps">Overlaps</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        );

      case 'cluster':
        return (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Layer</InputLabel>
                <Select value={analysis.cluster?.layer || ''} label="Layer">
                  {layers.map((layer) => (
                    <MenuItem key={layer} value={layer}>
                      {layer}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Algorithm</InputLabel>
                <Select value={analysis.cluster?.algorithm || 'k-means'} label="Algorithm">
                  <MenuItem value="k-means">K-Means</MenuItem>
                  <MenuItem value="dbscan">DBSCAN</MenuItem>
                  <MenuItem value="hierarchical">Hierarchical</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            {analysis.cluster?.algorithm === 'k-means' && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Number of Clusters (k)"
                  type="number"
                  value={analysis.cluster?.parameters?.k || 5}
                />
              </Grid>
            )}
            {analysis.cluster?.algorithm === 'dbscan' && (
              <>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Epsilon"
                    type="number"
                    value={analysis.cluster?.parameters?.eps || 0.5}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Min Points"
                    type="number"
                    value={analysis.cluster?.parameters?.minPoints || 5}
                  />
                </Grid>
              </>
            )}
          </Grid>
        );

      case 'density':
        return (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Layer</InputLabel>
                <Select value={analysis.density?.layer || ''} label="Layer">
                  {layers.map((layer) => (
                    <MenuItem key={layer} value={layer}>
                      {layer}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Type</InputLabel>
                <Select value={analysis.density?.type || 'kernel'} label="Type">
                  <MenuItem value="kernel">Kernel Density</MenuItem>
                  <MenuItem value="point">Point Density</MenuItem>
                  <MenuItem value="line">Line Density</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                size="small"
                label="Radius"
                type="number"
                value={analysis.density?.radius || 1000}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                size="small"
                label="Cell Size"
                type="number"
                value={analysis.density?.cellSize || 100}
              />
            </Grid>
          </Grid>
        );

      default:
        return null;
    }
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6">{analysis.name}</Typography>
          <Stack direction="row" spacing={1}>
            <Chip label={analysis.type} size="small" color="primary" variant="outlined" />
            {analysis.execution.auto && <Chip label="Auto" size="small" color="success" />}
          </Stack>
        </Stack>

        {renderConfig()}

        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Output Settings
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Output Name"
                value={analysis.output.name}
                onChange={(e) =>
                  onChange({
                    ...analysis,
                    output: { ...analysis.output, name: e.target.value },
                  })
                }
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={analysis.output.saveAsLayer}
                    onChange={(e) =>
                      onChange({
                        ...analysis,
                        output: { ...analysis.output, saveAsLayer: e.target.checked },
                      })
                    }
                  />
                }
                label="Save as new layer"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={analysis.execution.auto}
                    onChange={(e) =>
                      onChange({
                        ...analysis,
                        execution: { ...analysis.execution, auto: e.target.checked },
                      })
                    }
                  />
                }
                label="Auto-execute on data change"
              />
            </Grid>
          </Grid>
        </Box>
      </CardContent>
      <CardActions>
        <Button size="small" startIcon={<PlayIcon />}>
          Run Now
        </Button>
        <Button size="small" startIcon={<SettingsIcon />}>
          Advanced
        </Button>
        <Box sx={{ flex: 1 }} />
        <IconButton size="small" onClick={onDelete}>
          <DeleteIcon />
        </IconButton>
      </CardActions>
    </Card>
  );
};

export const SpatialAnalysisStep: React.FC<SpatialAnalysisStepProps> = ({ data, onComplete }) => {
  const [analyses, setAnalyses] = useState<SpatialAnalysis[]>(data.spatialAnalyses || []);
  const [showAddPanel, setShowAddPanel] = useState(false);

  const layers = data.layers?.map((l) => l.name) || [];

  const handleAddAnalysis = (type: SpatialAnalysisType) => {
    const newAnalysis: SpatialAnalysis = {
      id: crypto.randomUUID(),
      name: `${type} Analysis ${analyses.length + 1}`,
      type,
      output: {
        name: `${type}_result`,
        saveAsLayer: true,
      },
      execution: {
        auto: false,
      },
    };

    // Initialize type-specific config
    switch (type) {
      case 'buffer':
        newAnalysis.buffer = {
          sourceLayer: '',
          distance: 100,
          unit: 'meters',
          dissolve: false,
          endCap: 'round',
        };
        break;
      case 'intersection':
        newAnalysis.intersection = {
          layer1: '',
          layer2: '',
          outputFields: 'all',
          spatialRelation: 'intersects',
        };
        break;
      case 'cluster':
        newAnalysis.cluster = {
          layer: '',
          algorithm: 'k-means',
          parameters: { k: 5 },
        };
        break;
      case 'density':
        newAnalysis.density = {
          layer: '',
          type: 'kernel',
          radius: 1000,
          cellSize: 100,
        };
        break;
    }

    setAnalyses([...analyses, newAnalysis]);
    setShowAddPanel(false);
  };

  const handleUpdateAnalysis = (index: number, updated: SpatialAnalysis) => {
    const newAnalyses = [...analyses];
    newAnalyses[index] = updated;
    setAnalyses(newAnalyses);
  };

  const handleDeleteAnalysis = (index: number) => {
    setAnalyses(analyses.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    onComplete({ spatialAnalyses: analyses });
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Spatial Analysis Configuration
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Configure spatial analysis operations to derive insights from your data layers.
        </Typography>
      </Box>

      {layers.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <InfoIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            No Layers Available
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Please add data layers in the previous step before configuring spatial analysis.
          </Typography>
        </Paper>
      ) : (
        <>
          <Box sx={{ mb: 2 }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setShowAddPanel(!showAddPanel)}
              fullWidth
            >
              Add Spatial Analysis
            </Button>
          </Box>

          {showAddPanel && (
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Select Analysis Type
              </Typography>
              <Grid container spacing={1}>
                {analysisTypes.map((type) => (
                  <Grid item xs={12} sm={6} md={4} key={type.type}>
                    <Card
                      variant="outlined"
                      sx={{
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                      onClick={() => handleAddAnalysis(type.type)}
                    >
                      <CardContent>
                        <Stack direction="row" spacing={1} alignItems="center">
                          {type.icon}
                          <Box>
                            <Typography variant="subtitle2">{type.name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {type.description}
                            </Typography>
                          </Box>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          )}

          <Box sx={{ flex: 1, overflow: 'auto' }}>
            <Stack spacing={2}>
              {analyses.map((analysis, index) => (
                <AnalysisConfigPanel
                  key={analysis.id}
                  analysis={analysis}
                  layers={layers}
                  onChange={(updated) => handleUpdateAnalysis(index, updated)}
                  onDelete={() => handleDeleteAnalysis(index)}
                />
              ))}
            </Stack>
          </Box>

          {analyses.length > 0 && (
            <Paper sx={{ p: 2, mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Analysis Workflow
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                You can chain analyses by setting dependencies in the execution settings.
              </Typography>
              <FormControl fullWidth size="small" sx={{ mt: 1 }}>
                <InputLabel>Spatial Index</InputLabel>
                <Select value="rtree" label="Spatial Index">
                  <MenuItem value="rtree">R-Tree</MenuItem>
                  <MenuItem value="quadtree">Quadtree</MenuItem>
                  <MenuItem value="h3">H3 Hexagons</MenuItem>
                  <MenuItem value="s2">S2 Cells</MenuItem>
                </Select>
              </FormControl>
            </Paper>
          )}
        </>
      )}

      <Box sx={{ mt: 2 }}>
        <Button variant="contained" onClick={handleSubmit} fullWidth>
          Continue
        </Button>
      </Box>
    </Box>
  );
};
