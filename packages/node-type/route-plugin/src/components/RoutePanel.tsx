/**
 * RoutePanel - Side panel component for route plugin
 * ルートプラグイン用のサイドパネルコンポーネント
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Stack,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  IconButton,
  Collapse,
  Alert,
} from '@mui/material';
import {
  Route as RouteIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,

  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  DirectionsWalk,
  DriveEta,
  Train,
  DirectionsBike,
  Flight,
  LocalShipping,
} from '@mui/icons-material';
import type { NodeId } from '@hierarchidb/common-type';
import { TransportMode } from '../types';
import type { RouteEntity, RouteType } from '../types';
import { useTranslation } from '../i18n';
import { RouteBatchLaunchForm } from '../ui/components/RouteBatchLaunchForm';
import { RouteBatchSummary } from '../ui/components/RouteBatchSummary';
import { RouteBatchLiveProgress } from '../ui/components/RouteBatchLiveProgress';
import { createRouteBatchManager } from '../services/createRouteBatchManager';
import { isFlagEnabled } from '../services/config/flags';

export interface RoutePanelProps {
  nodeId: NodeId;
  entity: RouteEntity | null;
  onEdit: () => void;
  onDelete: () => void;
  onToggleVisibility: () => void;
}

const getTransportModeIcon = (mode: TransportMode) => {
  const iconMap: Record<string, React.ElementType> = {
    [TransportMode.CAR]: DriveEta,
    [TransportMode.TRUCK]: LocalShipping,
    [TransportMode.BUS]: DriveEta,
    [TransportMode.TRAIN]: Train,
    [TransportMode.SUBWAY]: Train,
    [TransportMode.TRAM]: Train,
    [TransportMode.BICYCLE]: DirectionsBike,
    [TransportMode.PEDESTRIAN]: DirectionsWalk,
    [TransportMode.MOTORCYCLE]: DriveEta,
    [TransportMode.AIRPLANE]: Flight,
    [TransportMode.FERRY]: LocalShipping,
  };
  
  const IconComponent = iconMap[mode] || DriveEta;
  return <IconComponent fontSize="small" />;
};

const getRouteTypeColor = (routeType: RouteType): 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info' => {
  const colorMap: Record<RouteType, 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info'> = {
    road: 'primary',
    railway: 'info',
    waterway: 'info',
    airway: 'secondary',
    walking: 'success',
    cycling: 'warning',
    hiking: 'success',
    shipping: 'info',
    pipeline: 'error',
    powerline: 'warning',
  };
  
  return colorMap[routeType] || 'primary';
};

export const RoutePanel: React.FC<RoutePanelProps> = ({
  nodeId: _nodeId,
  entity,
  onEdit,
  onDelete,
  onToggleVisibility,
}) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [lastJobId, setLastJobId] = useState<string | null>(null);

  // LaunchForm 内で net.port を取得するため、ここでは何もしない

  if (!entity) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="info">
          {t('panel.noData', 'No route data available')}
        </Alert>
      </Box>
    );
  }

  const formatDistance = (meters: number | undefined): string => {
    if (typeof meters !== 'number') return t('panel.unknown', 'Unknown');
    
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    } else {
      return `${(meters / 1000).toFixed(1)} km`;
    }
  };

  const formatDuration = (seconds: number | undefined): string => {
    if (typeof seconds !== 'number') return t('panel.unknown', 'Unknown');
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Card>
        <CardContent>
          {/* Route Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <RouteIcon color="primary" />
            <Typography variant="h6" sx={{ flex: 1 }}>
              {entity.name || t('panel.untitledRoute', 'Untitled Route')}
            </Typography>
            <IconButton
              size="small"
              onClick={onToggleVisibility}
              title={t('panel.toggleVisibility', 'Toggle Visibility')}
            >
              <VisibilityIcon />
            </IconButton>
          </Box>

          {/* Route Type */}
          <Box sx={{ mb: 2 }}>
            <Chip
              label={t(`routeTypes.${entity.routeType}`, entity.routeType)}
              color={getRouteTypeColor(entity.routeType)}
              size="small"
            />
          </Box>

          {/* Transport Modes */}
          {entity.transportModes && entity.transportModes.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {t('panel.transportModes', 'Transport Modes')}
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {entity.transportModes.map((mode) => (
                  <Chip
                    key={mode}
                    label={t(`transportModes.${mode}`, mode)}
                    icon={getTransportModeIcon(mode)}
                    size="small"
                    variant="outlined"
                  />
                ))}
              </Stack>
            </Box>
          )}

          {/* Route Stats */}
          <Box sx={{ mb: 2 }}>
            <Stack direction="row" spacing={2}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  {t('panel.distance', 'Distance')}
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  {formatDistance(entity.distance)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  {t('panel.duration', 'Duration')}
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  {formatDuration(entity.duration)}
                </Typography>
              </Box>
            </Stack>
          </Box>

          {/* Description */}
          {entity.description && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {entity.description}
              </Typography>
            </Box>
          )}

          {/* Expandable Details */}
          <Box>
            <Button
              onClick={() => setExpanded(!expanded)}
              endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              size="small"
              fullWidth
            >
              {t('panel.details', 'Details')}
            </Button>
            
            <Collapse in={expanded}>
              <Box sx={{ mt: 2 }}>
                <Divider sx={{ mb: 2 }} />
                
                {/* Waypoints */}
                {entity.waypoints && entity.waypoints.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      {t('panel.waypoints', 'Waypoints')} ({entity.waypoints.length})
                    </Typography>
                    <List dense>
                      {entity.waypoints.slice(0, showDetails ? undefined : 3).map((waypoint, index) => (
                        <ListItem key={index} sx={{ px: 0 }}>
                          <ListItemIcon sx={{ minWidth: 32 }}>
                            <Chip
                              label={index === 0 ? 'S' : index === entity.waypoints!.length - 1 ? 'E' : index}
                              size="small"
                              color={index === 0 ? 'success' : index === entity.waypoints!.length - 1 ? 'error' : 'default'}
                              sx={{ width: 24, height: 20, '& .MuiChip-label': { px: 0.5 } }}
                            />
                          </ListItemIcon>
                          <ListItemText
                            primary={`Waypoint ${index + 1}`}
                            secondary={`${waypoint[1].toFixed(4)}, ${waypoint[0].toFixed(4)}`}
                            primaryTypographyProps={{ variant: 'body2' }}
                            secondaryTypographyProps={{ variant: 'caption' }}
                          />
                        </ListItem>
                      ))})
                      
                      {!showDetails && entity.waypoints.length > 3 && (
                        <ListItem sx={{ px: 0 }}>
                          <Button
                            size="small"
                            onClick={() => setShowDetails(true)}
                          >
                            {t('panel.showMore', 'Show more waypoints')}
                          </Button>
                        </ListItem>
                      )}
                    </List>
                  </Box>
                )}

                {/* Route Configuration */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    {t('panel.configuration', 'Configuration')}
                  </Typography>
                  <Stack spacing={1}>
                    <Typography variant="body2">
                      {t('panel.category', 'Category')}: {t(`categories.${entity.category}`, entity.category)}
                    </Typography>
                  </Stack>
                </Box>

                {/* Processing Status */}
                <Box sx={{ mb: 2 }}>
                  <Chip
                    label={t('panel.ready', 'Ready')}
                    color="success"
                    size="small"
                    variant="outlined"
                  />
                </Box>
              </Box>
            </Collapse>
          </Box>
        </CardContent>

        <CardActions>
          <Button
            startIcon={<EditIcon />}
            onClick={onEdit}
            size="small"
          >
            {t('panel.edit', 'Edit')}
          </Button>
          <Button
            startIcon={<DeleteIcon />}
            onClick={onDelete}
            size="small"
            color="error"
          >
            {t('panel.delete', 'Delete')}
          </Button>
        </CardActions>
      </Card>

      {/* Batch Launch (feature flag) */}
      {isFlagEnabled('ROUTE_BATCH_ENABLED', true) && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              {t('panel.batch', 'Batch')}
            </Typography>
            <RouteBatchLaunchForm
              nodeId={_nodeId as any}
              createRouteBatchManager={createRouteBatchManager as any}
              onLaunched={(r) => setLastJobId(r.jobId)}
            />
          </CardContent>
        </Card>
      )}

      {lastJobId && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              {t('panel.progress', 'Progress')}
            </Typography>
            <div style={{ display: 'grid', gap: 8 }}>
              <RouteBatchLiveProgress jobId={lastJobId} />
              <RouteBatchSummary sessionId={lastJobId} />
            </div>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};
