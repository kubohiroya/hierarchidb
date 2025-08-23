/**
 * Project Dialog - Step 3: Resource References
 * Select and manage resource references using TreeNode.references
 */

import React, { useCallback, useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,

  IconButton,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputAdornment,
  Checkbox,
  ListItemIcon,
  Divider,
  Alert,
  AlertTitle,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  FolderOpen as FolderIcon,
  Map as MapIcon,
  Layers as LayersIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import type { NodeId } from '@hierarchidb/00-core';
import type { CreateProjectData } from '../../types';

/**
 * Mock resource data structure
 */
interface ResourceNode {
  id: NodeId;
  name: string;
  type: 'basemap' | 'stylemap' | 'folder';
  description?: string;
  parentId?: NodeId;
  children?: ResourceNode[];
}

/**
 * Props for Step3ResourceReferences
 */
export interface Step3ResourceReferencesProps {
  data: Partial<CreateProjectData>;
  onChange: (updates: Partial<CreateProjectData>) => void;
  projectNodeId?: NodeId;
}

/**
 * Step 3: Resource References Component
 */
export const Step3ResourceReferences: React.FC<Step3ResourceReferencesProps> = ({
  data,
  onChange,
}) => {
  const [resourceDialogOpen, setResourceDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedResources, setSelectedResources] = useState<NodeId[]>([]);
  const [availableResources, setAvailableResources] = useState<ResourceNode[]>([]);

  // Get current references
  const currentReferences = data.initialReferences || [];

  /**
   * Mock: Load available resources
   * In real implementation, this would fetch from TreeAPI
   */
  useEffect(() => {
    // Mock resource data
    const mockResources: ResourceNode[] = [
      {
        id: 'basemap-1' as NodeId,
        name: 'OpenStreetMap Base',
        type: 'basemap',
        description: 'Standard OpenStreetMap tiles',
      },
      {
        id: 'basemap-2' as NodeId,
        name: 'Satellite Imagery',
        type: 'basemap',
        description: 'High-resolution satellite tiles',
      },
      {
        id: 'stylemap-1' as NodeId,
        name: 'Population Density',
        type: 'stylemap',
        description: 'Population data visualization',
      },
      {
        id: 'stylemap-2' as NodeId,
        name: 'Economic Indicators',
        type: 'stylemap',
        description: 'GDP and economic metrics',
      },
      {
        id: 'folder-1' as NodeId,
        name: 'Regional Data',
        type: 'folder',
        description: 'Collection of regional datasets',
      },
    ];

    setAvailableResources(mockResources);
  }, []);

  /**
   * Handle add resource
   */
  const handleAddResource = useCallback(() => {
    setSelectedResources([]);
    setResourceDialogOpen(true);
  }, []);

  /**
   * Handle remove resource
   */
  const handleRemoveResource = useCallback((resourceId: NodeId) => {
    const updatedReferences = currentReferences.filter(id => id !== resourceId);
    onChange({ initialReferences: updatedReferences });
  }, [currentReferences, onChange]);

  /**
   * Handle resource selection in dialog
   */
  const handleResourceToggle = useCallback((resourceId: NodeId) => {
    setSelectedResources(prev => {
      if (prev.includes(resourceId)) {
        return prev.filter(id => id !== resourceId);
      } else {
        return [...prev, resourceId];
      }
    });
  }, []);

  /**
   * Handle confirm resource selection
   */
  const handleConfirmSelection = useCallback(() => {
    const updatedReferences = [
      ...currentReferences,
      ...selectedResources.filter(id => !currentReferences.includes(id)),
    ];
    onChange({ initialReferences: updatedReferences });
    setResourceDialogOpen(false);
    setSelectedResources([]);
    setSearchQuery('');
  }, [currentReferences, selectedResources, onChange]);

  /**
   * Filter resources based on search query
   */
  const filteredResources = availableResources.filter(resource =>
    resource.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (resource.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  /**
   * Get resource details by ID
   */
  const getResourceDetails = useCallback((resourceId: NodeId) => {
    return availableResources.find(resource => resource.id === resourceId);
  }, [availableResources]);

  /**
   * Get resource type icon
   */
  const getResourceIcon = useCallback((type: string) => {
    switch (type) {
      case 'basemap':
        return <MapIcon />;
      case 'stylemap':
        return <LayersIcon />;
      case 'folder':
        return <FolderIcon />;
      default:
        return <FolderIcon />;
    }
  }, []);

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Resource References
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Select resources from your Resources tree to include in this project. 
        These will be available for layer configuration and map composition.
      </Typography>

      {/* Current References */}
      <Card variant="outlined">
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="subtitle1">
              Selected Resources ({currentReferences.length})
            </Typography>
            <Button
              startIcon={<AddIcon />}
              onClick={handleAddResource}
              variant="outlined"
              size="small"
            >
              Add Resources
            </Button>
          </Box>

          {currentReferences.length === 0 ? (
            <Alert severity="info">
              <AlertTitle>No Resources Selected</AlertTitle>
              Click "Add Resources" to select basemaps, stylemaps, or other resources for your project.
            </Alert>
          ) : (
            <List>
              {currentReferences.map((resourceId, index) => {
                const resource = getResourceDetails(resourceId);
                return (
                  <React.Fragment key={resourceId}>
                    {index > 0 && <Divider />}
                    <ListItem>
                      <ListItemIcon>
                        {getResourceIcon(resource?.type || 'folder')}
                      </ListItemIcon>
                      <ListItemText
                        primary={resource?.name || `Resource ${resourceId}`}
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {resource?.description || 'No description available'}
                            </Typography>
                            <Chip
                              label={resource?.type || 'unknown'}
                              size="small"
                              variant="outlined"
                              sx={{ mt: 1 }}
                            />
                          </Box>
                        }
                      />
                      secondaryAction={
                        <IconButton
                          onClick={() => handleRemoveResource(resourceId)}
                          size="small"
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      }
                    </ListItem>
                  </React.Fragment>
                );
              })}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Resource Selection Dialog */}
      <Dialog
        open={resourceDialogOpen}
        onClose={() => setResourceDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography variant="h6">
              Select Resources
            </Typography>
            <IconButton
              onClick={() => setResourceDialogOpen(false)}
              size="small"
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent>
          {/* Search */}
          <TextField
            fullWidth
            placeholder="Search resources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ mb: 2 }}
          />

          {/* Resource List */}
          <List>
            {filteredResources.map((resource, index) => {
              const isSelected = selectedResources.includes(resource.id);
              const isAlreadyAdded = currentReferences.includes(resource.id);

              return (
                <React.Fragment key={resource.id}>
                  {index > 0 && <Divider />}
                  <ListItem
                    onClick={() => !isAlreadyAdded && handleResourceToggle(resource.id)}
                    sx={{ 
                      cursor: isAlreadyAdded ? 'default' : 'pointer',
                      opacity: isAlreadyAdded ? 0.5 : 1
                    }}
                  >
                    <ListItemIcon>
                      <Checkbox
                        checked={isSelected || isAlreadyAdded}
                        disabled={isAlreadyAdded}
                      />
                    </ListItemIcon>
                    <ListItemIcon>
                      {getResourceIcon(resource.type)}
                    </ListItemIcon>
                    <ListItemText
                      primary={resource.name}
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {resource.description}
                          </Typography>
                          <Box display="flex" gap={1} mt={1}>
                            <Chip
                              label={resource.type}
                              size="small"
                              variant="outlined"
                            />
                            {isAlreadyAdded && (
                              <Chip
                                label="Already added"
                                size="small"
                                color="success"
                                variant="outlined"
                              />
                            )}
                          </Box>
                        </Box>
                      }
                    />
                  </ListItem>
                </React.Fragment>
              );
            })}
          </List>

          {filteredResources.length === 0 && (
            <Typography color="text.secondary" textAlign="center" py={3}>
              {searchQuery ? 'No resources match your search' : 'No resources available'}
            </Typography>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setResourceDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmSelection}
            variant="contained"
            disabled={selectedResources.length === 0}
          >
            Add Selected ({selectedResources.length})
          </Button>
        </DialogActions>
      </Dialog>

      {/* Next Steps Info */}
      {currentReferences.length > 0 && (
        <Box mt={3}>
          <Alert severity="success">
            <AlertTitle>Ready for Layer Configuration</AlertTitle>
            You've selected {currentReferences.length} resource(s). 
            In the next step, you'll be able to configure how each resource appears as a layer on your map.
          </Alert>
        </Box>
      )}
    </Box>
  );
};

export default Step3ResourceReferences;