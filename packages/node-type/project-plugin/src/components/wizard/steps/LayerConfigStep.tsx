import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemIcon,
  ListItemSecondaryAction,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Slider,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Description as PropertyIcon,
  DragIndicator as DragIcon,
  Edit as EditIcon,
  GridOn as ShapeIcon,
  Layers as LayersIcon,
  Place as LocationIcon,
  Timeline as RouteIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import type { NodeId } from '@hierarchidb/common-type';
import type { ProjectEntity, ProjectLayer } from '~/types/project-types';

interface LayerConfigStepProps {
  data: Partial<ProjectEntity>;
  nodeId: NodeId;
  onComplete: (data: Partial<ProjectEntity>) => void;
}

interface LayerEditDialogProps {
  open: boolean;
  layer?: ProjectLayer;
  onClose: () => void;
  onSave: (layer: ProjectLayer) => void;
}

const nodeTypeIcons: Record<string, React.ReactNode> = {
  shape: <ShapeIcon />,
  location: <LocationIcon />,
  route: <RouteIcon />,
  resolver: <PropertyIcon />,
};

const LayerEditDialog: React.FC<LayerEditDialogProps> = ({ open, layer, onClose, onSave }) => {
  const [formData, setFormData] = useState<ProjectLayer>(
    layer || {
      id: crypto.randomUUID(),
      name: '',
      source: {
        nodeId: '' as NodeId,
        nodeType: 'shape',
        nodeName: '',
        lastUpdated: new Date(),
        recordCount: 0,
      },
      config: {
        enabled: true,
        order: 0,
        opacity: 1.0,
        filters: [],
        temporal: {
          enabled: false,
          field: '',
        },
      },
      style: {
        type: 'simple',
        point: {
          symbol: 'circle',
          size: 8,
          color: '#3388ff',
          strokeColor: '#ffffff',
          strokeWidth: 1,
        },
        line: {
          color: '#3388ff',
          width: 3,
        },
        polygon: {
          fillColor: '#3388ff',
          fillOpacity: 0.5,
          strokeColor: '#3388ff',
          strokeWidth: 2,
        },
      },
      interaction: {
        hoverable: true,
        clickable: true,
        selectable: false,
        editable: false,
        popup: {
          enabled: true,
          template: '',
          fields: [],
        },
      },
    },
  );

  const handleSave = () => {
    onSave(formData);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{layer ? 'Edit Layer' : 'Add Layer'}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Layer Name"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
          </Grid>

          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom>
              Data Source
            </Typography>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Node Type</InputLabel>
                    <Select
                      value={formData.source.nodeType}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          source: { ...prev.source, nodeType: e.target.value as any },
                        }))
                      }
                      label="Node Type"
                    >
                      <MenuItem value="shape">Shape</MenuItem>
                      <MenuItem value="location">Location</MenuItem>
                      <MenuItem value="route">Route</MenuItem>
                      <MenuItem value="resolver">Property Resolver</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Node Name"
                    value={formData.source.nodeName}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        source: { ...prev.source, nodeName: e.target.value },
                      }))
                    }
                  />
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom>
              Display Settings
            </Typography>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography gutterBottom>
                    Opacity: {Math.round(formData.config.opacity * 100)}%
                  </Typography>
                  <Slider
                    value={formData.config.opacity}
                    onChange={(_, value) =>
                      setFormData((prev) => ({
                        ...prev,
                        config: { ...prev.config, opacity: value as number },
                      }))
                    }
                    min={0}
                    max={1}
                    step={0.1}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Min Zoom"
                    type="number"
                    value={formData.config.minZoom || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        config: { ...prev.config, minZoom: parseInt(e.target.value) || undefined },
                      }))
                    }
                    inputProps={{ min: 0, max: 22 }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Max Zoom"
                    type="number"
                    value={formData.config.maxZoom || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        config: { ...prev.config, maxZoom: parseInt(e.target.value) || undefined },
                      }))
                    }
                    inputProps={{ min: 0, max: 22 }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.config.enabled}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            config: { ...prev.config, enabled: e.target.checked },
                          }))
                        }
                      />
                    }
                    label="Enabled by default"
                  />
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom>
              Style
            </Typography>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Style Type</InputLabel>
                <Select
                  value={formData.style.type}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      style: { ...prev.style, type: e.target.value as any },
                    }))
                  }
                  label="Style Type"
                >
                  <MenuItem value="simple">Simple</MenuItem>
                  <MenuItem value="categorized">Categorized</MenuItem>
                  <MenuItem value="graduated">Graduated</MenuItem>
                  <MenuItem value="rule-based">Rule Based</MenuItem>
                </Select>
              </FormControl>

              {/* Point Style */}
              {formData.source.nodeType === 'location' && (
                <Box>
                  <Typography variant="caption" gutterBottom>
                    Point Style
                  </Typography>
                  <Grid container spacing={1}>
                    <Grid item xs={4}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Symbol</InputLabel>
                        <Select value={formData.style.point?.symbol || 'circle'} label="Symbol">
                          <MenuItem value="circle">Circle</MenuItem>
                          <MenuItem value="square">Square</MenuItem>
                          <MenuItem value="triangle">Triangle</MenuItem>
                          <MenuItem value="star">Star</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={4}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Size"
                        type="number"
                        value={formData.style.point?.size || 8}
                      />
                    </Grid>
                    <Grid item xs={4}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Color"
                        type="color"
                        value={formData.style.point?.color || '#3388ff'}
                      />
                    </Grid>
                  </Grid>
                </Box>
              )}

              {/* Line Style */}
              {formData.source.nodeType === 'route' && (
                <Box>
                  <Typography variant="caption" gutterBottom>
                    Line Style
                  </Typography>
                  <Grid container spacing={1}>
                    <Grid item xs={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Width"
                        type="number"
                        value={formData.style.line?.width || 3}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Color"
                        type="color"
                        value={formData.style.line?.color || '#3388ff'}
                      />
                    </Grid>
                  </Grid>
                </Box>
              )}

              {/* Polygon Style */}
              {formData.source.nodeType === 'shape' && (
                <Box>
                  <Typography variant="caption" gutterBottom>
                    Polygon Style
                  </Typography>
                  <Grid container spacing={1}>
                    <Grid item xs={4}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Fill Color"
                        type="color"
                        value={formData.style.polygon?.fillColor || '#3388ff'}
                      />
                    </Grid>
                    <Grid item xs={4}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Fill Opacity"
                        type="number"
                        value={formData.style.polygon?.fillOpacity || 0.5}
                        inputProps={{ min: 0, max: 1, step: 0.1 }}
                      />
                    </Grid>
                    <Grid item xs={4}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Stroke Width"
                        type="number"
                        value={formData.style.polygon?.strokeWidth || 2}
                      />
                    </Grid>
                  </Grid>
                </Box>
              )}
            </Paper>
          </Grid>

          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom>
              Interaction
            </Typography>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.interaction.hoverable}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            interaction: { ...prev.interaction, hoverable: e.target.checked },
                          }))
                        }
                      />
                    }
                    label="Hoverable"
                  />
                </Grid>
                <Grid item xs={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.interaction.clickable}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            interaction: { ...prev.interaction, clickable: e.target.checked },
                          }))
                        }
                      />
                    }
                    label="Clickable"
                  />
                </Grid>
                <Grid item xs={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.interaction.selectable}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            interaction: { ...prev.interaction, selectable: e.target.checked },
                          }))
                        }
                      />
                    }
                    label="Selectable"
                  />
                </Grid>
                <Grid item xs={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.interaction.editable}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            interaction: { ...prev.interaction, editable: e.target.checked },
                          }))
                        }
                      />
                    }
                    label="Editable"
                  />
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export const LayerConfigStep: React.FC<LayerConfigStepProps> = ({ data, onComplete }) => {
  const [layers, setLayers] = useState<ProjectLayer[]>(data.layers || []);
  const [editDialog, setEditDialog] = useState<{ open: boolean; layer?: ProjectLayer }>({
    open: false,
  });

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(layers);
    const [reorderedItem] = items.splice(result.source.index, 1);
    if (!reorderedItem) return;
    items.splice(result.destination.index, 0, reorderedItem);

    // Update order values
    const updatedItems = items.map((item, index) => ({
      ...item,
      config: { ...item.config, order: index },
    }));

    setLayers(updatedItems);
  };

  const handleAddLayer = () => {
    setEditDialog({ open: true });
  };

  const handleEditLayer = (layer: ProjectLayer) => {
    setEditDialog({ open: true, layer });
  };

  const handleSaveLayer = (layer: ProjectLayer) => {
    const existingIndex = layers.findIndex((l) => l.id === layer.id);
    if (existingIndex >= 0) {
      const updated = [...layers];
      updated[existingIndex] = layer;
      setLayers(updated);
    } else {
      setLayers([...layers, { ...layer, config: { ...layer.config, order: layers.length } }]);
    }
  };

  const handleDeleteLayer = (layerId: string) => {
    setLayers(layers.filter((l) => l.id !== layerId));
  };

  const handleToggleVisibility = (layerId: string) => {
    setLayers(
      layers.map((l) =>
        l.id === layerId ? { ...l, config: { ...l.config, enabled: !l.config.enabled } } : l,
      ),
    );
  };

  const handleSubmit = () => {
    onComplete({ layers });
  };

  useEffect(() => {
    // Auto-save when returning to this step
    if (data.layers !== layers) {
      handleSubmit();
    }
  }, []);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Data Layers Configuration
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Add and configure data layers from Shape, Location, Route, and Property Resolver nodes.
        </Typography>
      </Box>

      <Box sx={{ mb: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddLayer} fullWidth>
          Add Layer
        </Button>
      </Box>

      {layers.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <LayersIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            No Layers Added
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Click "Add Layer" to start building your project's data layers.
          </Typography>
        </Paper>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="layers">
            {(provided) => (
              <List {...provided.droppableProps} ref={provided.innerRef}>
                {layers.map((layer, index) => (
                  <Draggable key={layer.id} draggableId={layer.id} index={index}>
                    {(provided, snapshot) => (
                      <ListItem
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        sx={{
                          mb: 1,
                          bgcolor: snapshot.isDragging ? 'action.hover' : 'background.paper',
                          borderRadius: 1,
                          border: 1,
                          borderColor: 'divider',
                        }}
                      >
                        <ListItemIcon {...provided.dragHandleProps}>
                          <DragIcon />
                        </ListItemIcon>
                        <ListItemIcon>{nodeTypeIcons[layer.source.nodeType]}</ListItemIcon>
                        <ListItemText
                          primary={layer.name}
                          secondary={
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Chip label={layer.source.nodeType} size="small" variant="outlined" />
                              <Typography variant="caption">
                                {layer.source.recordCount} features
                              </Typography>
                              <Typography variant="caption">
                                Opacity: {Math.round(layer.config.opacity * 100)}%
                              </Typography>
                            </Stack>
                          }
                        />
                        <ListItemSecondaryAction>
                          <IconButton onClick={() => handleToggleVisibility(layer.id)} size="small">
                            {layer.config.enabled ? <VisibilityIcon /> : <VisibilityOffIcon />}
                          </IconButton>
                          <IconButton onClick={() => handleEditLayer(layer)} size="small">
                            <EditIcon />
                          </IconButton>
                          <IconButton onClick={() => handleDeleteLayer(layer.id)} size="small">
                            <DeleteIcon />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </List>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {layers.length > 0 && (
        <Paper sx={{ p: 2, mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Layer Groups (Optional)
          </Typography>
          <Typography variant="body2" color="text.secondary">
            You can organize layers into groups for better management.
          </Typography>
          <Button variant="outlined" size="small" startIcon={<AddIcon />} sx={{ mt: 1 }}>
            Create Group
          </Button>
        </Paper>
      )}

      <LayerEditDialog
        open={editDialog.open}
        layer={editDialog.layer}
        onClose={() => setEditDialog({ open: false })}
        onSave={handleSaveLayer}
      />
    </Box>
  );
};
