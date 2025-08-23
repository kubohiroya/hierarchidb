/**
 * Project Plugin - Panel Component
 * Right-side panel for project information and quick actions
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Divider,
  Alert,
  LinearProgress,
  Tooltip,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Download as DownloadIcon,
  Share as ShareIcon,
  MoreVert as MoreVertIcon,
  Map as MapIcon,
  Layers as LayersIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import type { NodeId } from '@hierarchidb/00-core';
import type { ProjectEntity } from '../../shared';

/**
 * Props for ProjectPanel
 */
export interface ProjectPanelProps {
  project: ProjectEntity;
  isLoading?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onExport: (format: string) => void;
  onShare: () => void;
  onToggleLayerVisibility: (resourceId: NodeId) => void;
  onRefreshAggregation: () => void;
}

/**
 * Project Panel Component
 */
export const ProjectPanel: React.FC<ProjectPanelProps> = ({
  project,
  isLoading = false,
  onEdit,
  onDelete,
  onExport,
  onShare,
  onToggleLayerVisibility,
  onRefreshAggregation,
}) => {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(null);

  /**
   * Handle menu open
   */
  const handleMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchor(event.currentTarget);
  }, []);

  /**
   * Handle menu close
   */
  const handleMenuClose = useCallback(() => {
    setMenuAnchor(null);
  }, []);

  /**
   * Handle export menu open
   */
  const handleExportMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setExportMenuAnchor(event.currentTarget);
  }, []);

  /**
   * Handle export menu close
   */
  const handleExportMenuClose = useCallback(() => {
    setExportMenuAnchor(null);
  }, []);

  /**
   * Handle export selection
   */
  const handleExportSelection = useCallback((format: string) => {
    onExport(format);
    handleExportMenuClose();
  }, [onExport, handleExportMenuClose]);

  /**
   * Get layer configurations as array
   */
  const layerConfigs = Object.entries(project.layerConfigurations || {});
  const visibleLayers = layerConfigs.filter(([, config]) => config.isVisible);

  /**
   * Format last aggregated time
   */
  const formatLastAggregated = (timestamp: number) => {
    if (timestamp === 0) return 'Never';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        return diffMinutes < 1 ? 'Just now' : `${diffMinutes} minutes ago`;
      }
      return `${diffHours} hours ago`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (isLoading) {
    return (
      <Box p={2}>
        <LinearProgress />
        <Typography variant="body2" color="text.secondary" mt={1}>
          Loading project...
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Project Header */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Box display="flex" alignItems="flex-start" justifyContent="space-between" mb={2}>
            <Box display="flex" alignItems="center" gap={1}>
              <MapIcon color="primary" />
              <Typography variant="h6" component="div">
                {project.name}
              </Typography>
            </Box>
            <IconButton
              size="small"
              onClick={handleMenuOpen}
            >
              <MoreVertIcon />
            </IconButton>
          </Box>

          {project.description && (
            <Typography variant="body2" color="text.secondary" mb={2}>
              {project.description}
            </Typography>
          )}

          {/* Status Chips */}
          <Box display="flex" gap={1} flexWrap="wrap">
            <Chip
              label={`${layerConfigs.length} resources`}
              size="small"
              variant="outlined"
            />
            <Chip
              label={`${visibleLayers.length} visible`}
              size="small"
              variant="outlined"
              color={visibleLayers.length > 0 ? 'success' : 'default'}
            />
            <Chip
              label={project.aggregationMetadata.hasErrors ? 'Has errors' : 'No errors'}
              size="small"
              variant="outlined"
              color={project.aggregationMetadata.hasErrors ? 'error' : 'success'}
            />
          </Box>
        </CardContent>

        <CardActions>
          <Button
            size="small"
            startIcon={<EditIcon />}
            onClick={onEdit}
          >
            Edit
          </Button>
          <Button
            size="small"
            startIcon={<DownloadIcon />}
            onClick={handleExportMenuOpen}
          >
            Export
          </Button>
          <Button
            size="small"
            startIcon={<ShareIcon />}
            onClick={onShare}
          >
            Share
          </Button>
        </CardActions>
      </Card>

      {/* Map Configuration */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <MapIcon color="primary" fontSize="small" />
            <Typography variant="subtitle2">
              Map Configuration
            </Typography>
          </Box>

          <List dense>
            <ListItem>
              <ListItemText
                primary="Center"
                secondary={`${project.mapConfig.center[1].toFixed(4)}°N, ${project.mapConfig.center[0].toFixed(4)}°E`}
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Zoom"
                secondary={`Level ${project.mapConfig.zoom}`}
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Rotation"
                secondary={`${project.mapConfig.bearing}° bearing, ${project.mapConfig.pitch}° pitch`}
              />
            </ListItem>
          </List>
        </CardContent>
      </Card>

      {/* Layers */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Box display="flex" alignItems="center" gap={1}>
              <LayersIcon color="primary" fontSize="small" />
              <Typography variant="subtitle2">
                Layers ({layerConfigs.length})
              </Typography>
            </Box>
            <Tooltip title="Refresh aggregation">
              <IconButton
                size="small"
                onClick={onRefreshAggregation}
                disabled={layerConfigs.length === 0}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>

          {layerConfigs.length === 0 ? (
            <Alert severity="info">
              No layers configured
            </Alert>
          ) : (
            <List dense>
              {layerConfigs
                .sort(([, a], [, b]) => (b.layerOrder || 0) - (a.layerOrder || 0))
                .map(([resourceId, config], index) => (
                  <React.Fragment key={resourceId}>
                    {index > 0 && <Divider />}
                    <ListItem>
                      <ListItemIcon>
                        <IconButton
                          size="small"
                          onClick={() => onToggleLayerVisibility(resourceId as NodeId)}
                        >
                          {config.isVisible ? (
                            <VisibilityIcon fontSize="small" />
                          ) : (
                            <VisibilityOffIcon fontSize="small" />
                          )}
                        </IconButton>
                      </ListItemIcon>
                      <ListItemText
                        primary={`Resource ${resourceId}`}
                        secondary={
                          <Box display="flex" gap={0.5} mt={0.5}>
                            <Chip
                              label={config.layerType}
                              size="small"
                              variant="outlined"
                            />
                            <Chip
                              label={`${Math.round(config.opacity * 100)}%`}
                              size="small"
                              variant="outlined"
                            />
                          </Box>
                        }
                      />
                    </ListItem>
                  </React.Fragment>
                ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Aggregation Status */}
      <Card variant="outlined">
        <CardContent>
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <InfoIcon color="primary" fontSize="small" />
            <Typography variant="subtitle2">
              Aggregation Status
            </Typography>
          </Box>

          <List dense>
            <ListItem>
              <ListItemText
                primary="Last Updated"
                secondary={formatLastAggregated(project.aggregationMetadata.lastAggregated)}
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Resource Count"
                secondary={`${project.aggregationMetadata.resourceCount} processed`}
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Layer Count"
                secondary={`${project.aggregationMetadata.layerCount} configured`}
              />
            </ListItem>
            {project.aggregationMetadata.aggregationTime && (
              <ListItem>
                <ListItemText
                  primary="Processing Time"
                  secondary={`${project.aggregationMetadata.aggregationTime}ms`}
                />
              </ListItem>
            )}
          </List>

          {project.aggregationMetadata.hasErrors && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {project.aggregationMetadata.errorMessages?.length || 0} error(s) detected
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Main Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => { onEdit(); handleMenuClose(); }}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          Edit Project
        </MenuItem>
        <MenuItem onClick={() => { onRefreshAggregation(); handleMenuClose(); }}>
          <ListItemIcon>
            <RefreshIcon fontSize="small" />
          </ListItemIcon>
          Refresh Aggregation
        </MenuItem>
        <Divider />
        <MenuItem 
          onClick={() => { onDelete(); handleMenuClose(); }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          Delete Project
        </MenuItem>
      </Menu>

      {/* Export Menu */}
      <Menu
        anchorEl={exportMenuAnchor}
        open={Boolean(exportMenuAnchor)}
        onClose={handleExportMenuClose}
      >
        <MenuItem onClick={() => handleExportSelection('png')}>
          Export as PNG
        </MenuItem>
        <MenuItem onClick={() => handleExportSelection('pdf')}>
          Export as PDF
        </MenuItem>
        <MenuItem onClick={() => handleExportSelection('geojson')}>
          Export as GeoJSON
        </MenuItem>
        <MenuItem onClick={() => handleExportSelection('kml')}>
          Export as KML
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default ProjectPanel;