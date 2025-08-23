/**
 * Project Dialog - Step 5: Preview
 * Review all project settings before finalizing
 */

import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  List,
  ListItem,
  ListItemText,

  Divider,
  Alert,
  AlertTitle,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import {
  Info as InfoIcon,
  Map as MapIcon,
  Layers as LayersIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { type CreateProjectData, DEFAULT_MAP_CONFIG, DEFAULT_RENDER_CONFIG, type LayerConfiguration } from '../../types';
// import { MapLibreMap, type MapViewState } from '@hierarchidb/ui-map';

/**
 * Props for Step5Preview
 */
export interface Step5PreviewProps {
  data: Partial<CreateProjectData>;
  mode: 'create' | 'edit';
}

/**
 * Step 5: Preview Component
 */
export const Step5Preview: React.FC<Step5PreviewProps> = ({
  data,
  mode,
}) => {
  // Get configurations with defaults
  const mapConfig = {
    ...DEFAULT_MAP_CONFIG,
    ...data.mapConfig,
  };

  const renderConfig = {
    ...DEFAULT_RENDER_CONFIG,
    ...data.renderConfig,
  };

  const references = data.initialReferences || [];
  const layerConfigs = (data as any).layerConfigurations || {};

  /**
   * Get readiness status
   */
  const getReadinessStatus = () => {
    const issues: string[] = [];
    
    if (!data.name || data.name.trim().length === 0) {
      issues.push('Project name is required');
    }
    
    if (references.length === 0) {
      issues.push('No resources selected - project will be empty');
    }
    
    return {
      isReady: issues.length === 0,
      issues,
    };
  };

  const readiness = getReadinessStatus();

  /**
   * Format coordinate for display
   */
  const formatCoordinate = (coord: number, type: 'lat' | 'lng') => {
    const direction = type === 'lat' ? (coord >= 0 ? 'N' : 'S') : (coord >= 0 ? 'E' : 'W');
    return `${Math.abs(coord).toFixed(6)}°${direction}`;
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Review Project
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Review all settings before {mode === 'create' ? 'creating' : 'updating'} your project. 
        You can go back to make changes or proceed to finalize.
      </Typography>

      {/* Readiness Status */}
      <Alert 
        severity={readiness.isReady ? 'success' : 'warning'} 
        sx={{ mb: 3 }}
        icon={readiness.isReady ? <CheckCircleIcon /> : <InfoIcon />}
      >
        <AlertTitle>
          {readiness.isReady 
            ? `Ready to ${mode === 'create' ? 'Create' : 'Update'} Project` 
            : 'Review Required'
          }
        </AlertTitle>
        {readiness.isReady ? (
          'All required information has been provided. Your project is ready to be created.'
        ) : (
          <Box component="ul" sx={{ m: 0, pl: 2 }}>
            {readiness.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </Box>
        )}
      </Alert>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Basic Information and Map Configuration Row */}
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {/* Basic Information */}
          <Box sx={{ flex: '1 1 400px' }}>
            <Card variant="outlined">
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <InfoIcon color="primary" />
                  <Typography variant="subtitle1">
                    Basic Information
                  </Typography>
                </Box>
                
                <List dense>
                  <ListItem>
                    <ListItemText
                      primary="Project Name"
                      secondary={data.name || 'Not set'}
                    />
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemText
                      primary="Description"
                      secondary={
                        data.description 
                          ? (data.description.length > 100 
                              ? `${data.description.substring(0, 100)}...` 
                              : data.description)
                          : 'No description provided'
                      }
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Box>

          {/* Map Configuration */}
          <Box sx={{ flex: '1 1 400px' }}>
            <Card variant="outlined">
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <MapIcon color="primary" />
                  <Typography variant="subtitle1">
                    Map Configuration
                  </Typography>
                </Box>
                
                <List dense>
                  <ListItem>
                    <ListItemText
                      primary="Initial Center"
                      secondary={`${formatCoordinate(mapConfig.center[1], 'lat')}, ${formatCoordinate(mapConfig.center[0], 'lng')}`}
                    />
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemText
                      primary="Zoom Level"
                      secondary={`${mapConfig.zoom} (${
                        mapConfig.zoom < 3 ? 'World' :
                        mapConfig.zoom < 7 ? 'Country' :
                        mapConfig.zoom < 12 ? 'City' :
                        mapConfig.zoom < 16 ? 'Neighborhood' : 'Street'
                      } view)`}
                    />
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemText
                      primary="Rotation & Tilt"
                      secondary={`${mapConfig.bearing}° bearing, ${mapConfig.pitch}° pitch`}
                    />
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemText
                      primary="Rendering"
                      secondary={
                        <Box display="flex" gap={1} mt={0.5}>
                          <Chip 
                            label={renderConfig.pixelRatio > 1 ? 'High DPI' : 'Standard DPI'} 
                            size="small" 
                          />
                          <Chip 
                            label={renderConfig.preserveDrawingBuffer ? 'Screenshots Enabled' : 'Screenshots Disabled'} 
                            size="small" 
                          />
                        </Box>
                      }
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Box>
        </Box>

        {/* Live Map Preview */}
        <Box>
          <Card variant="outlined">
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <MapIcon color="primary" />
                <Typography variant="subtitle1">
                  Live Map Preview
                </Typography>
              </Box>
              
              <Box 
                sx={{ 
                  height: 400, 
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  overflow: 'hidden'
                }}
              >
                {/* Temporarily disabled until ui-map package is properly configured */}
                <Box 
                  sx={{ 
                    width: '100%', 
                    height: '100%', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    backgroundColor: '#f5f5f5',
                    color: 'text.secondary',
                    border: '2px dashed',
                    borderColor: 'divider'
                  }}
                >
                  <Box textAlign="center">
                    <Typography variant="h6" gutterBottom>
                      Map Preview
                    </Typography>
                    <Typography variant="body2">
                      Center: {mapConfig.center[1].toFixed(4)}°N, {mapConfig.center[0].toFixed(4)}°E
                    </Typography>
                    <Typography variant="body2">
                      Zoom: {mapConfig.zoom}, Bearing: {mapConfig.bearing}°
                    </Typography>
                  </Box>
                </Box>
              </Box>
              
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                This preview shows how your project map will appear with the current settings. 
                The actual project will include your selected resource layers.
              </Typography>
            </CardContent>
          </Card>
        </Box>

        {/* Resource References */}
        <Box>
          <Card variant="outlined">
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <LayersIcon color="primary" />
                <Typography variant="subtitle1">
                  Resource References ({references.length})
                </Typography>
              </Box>

              {references.length === 0 ? (
                <Alert severity="info">
                  No resources have been selected. The project will be created without any initial data sources.
                </Alert>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Resource</TableCell>
                        <TableCell>Layer Type</TableCell>
                        <TableCell>Visibility</TableCell>
                        <TableCell>Opacity</TableCell>
                        <TableCell>Order</TableCell>
                        <TableCell>Zoom Range</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {references.map((resourceId, index) => {
                        const layerConfig = layerConfigs[resourceId] as LayerConfiguration;
                        return (
                          <TableRow key={resourceId}>
                            <TableCell>
                              <Typography variant="body2" fontWeight="medium">
                                Resource {resourceId}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={layerConfig?.layerType || 'raster'} 
                                size="small" 
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell>
                              <Box display="flex" alignItems="center" gap={1}>
                                {layerConfig?.isVisible !== false ? (
                                  <VisibilityIcon fontSize="small" color="primary" />
                                ) : (
                                  <VisibilityOffIcon fontSize="small" color="disabled" />
                                )}
                                <Typography variant="body2">
                                  {layerConfig?.isVisible !== false ? 'Visible' : 'Hidden'}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              {Math.round((layerConfig?.opacity || 1) * 100)}%
                            </TableCell>
                            <TableCell>
                              {layerConfig?.layerOrder ?? index}
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {layerConfig?.visibilityRules?.minZoom || 0} - {layerConfig?.visibilityRules?.maxZoom || 22}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Box>

        {/* Summary Statistics */}
        <Box>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                Project Summary
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                <Box sx={{ flex: '1 1 150px', textAlign: 'center' }}>
                  <Typography variant="h4" color="primary">
                    {references.length}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Resources
                  </Typography>
                </Box>
                <Box sx={{ flex: '1 1 150px', textAlign: 'center' }}>
                  <Typography variant="h4" color="primary">
                    {Object.values(layerConfigs).filter((config: any) => config?.isVisible !== false).length}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Visible Layers
                  </Typography>
                </Box>
                <Box sx={{ flex: '1 1 150px', textAlign: 'center' }}>
                  <Typography variant="h4" color="primary">
                    {mapConfig.zoom}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Initial Zoom
                  </Typography>
                </Box>
                <Box sx={{ flex: '1 1 150px', textAlign: 'center' }}>
                  <Typography variant="h4" color="primary">
                    {renderConfig.preserveDrawingBuffer ? '✓' : '✗'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Screenshots
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
};

export default Step5Preview;