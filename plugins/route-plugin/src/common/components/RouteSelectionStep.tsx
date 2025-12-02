/**
 * RouteSelectionStep - Step 2 of route creation base-dialog
 * Allows users to select waypoints and configure route options
 */

import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Add, MyLocation, Remove } from '@mui/icons-material';
import type { RouteEntity, RouteUpdaterPayload } from '../entities/RouteEntity.js';
import { useTranslation } from '../i18n/index.js';
import { getRouteUpdaterPayload } from '../utils/draft.js';

export interface RouteSelectionStepProps {
  draft: RouteUpdaterPayload;
  onUpdate: (updates: Partial<RouteEntity>) => void;
  onValidationChange: (isValid: boolean) => void;
}

interface Waypoint {
  id: string;
  name: string;
  coordinates?: [number, number]; // [longitude, latitude]
  address?: string;
}

export const RouteSelectionStep: React.FC<RouteSelectionStepProps> = ({
  draft: draftProp,
  onUpdate,
  onValidationChange,
}) => {
  const { t } = useTranslation();
  const draft = useMemo(() => getRouteUpdaterPayload(draftProp), [draftProp]);
  const emitUpdate = useCallback((updates: Partial<RouteEntity>) => {
    onUpdate({
      ...updates,
    });
  }, [onUpdate]);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([
    { id: '1', name: t('base-dialog.routeSelection.startPoint', 'Start Point') },
    { id: '2', name: t('base-dialog.routeSelection.endPoint', 'End Point') },
  ]);
  const [isCalculating, setIsCalculating] = useState(false);

  const handleAddWaypoint = () => {
    const newWaypoint: Waypoint = {
      id: `waypoint-${Date.now()}`,
      name: t('base-dialog.routeSelection.waypoint', 'Waypoint') + ` ${waypoints.length - 1}`,
    };

    // Insert before the last waypoint (end point)
    const newWaypoints = [...waypoints];
    newWaypoints.splice(-1, 0, newWaypoint);
    setWaypoints(newWaypoints);
  };

  const handleRemoveWaypoint = (waypointId: string) => {
    if (waypoints.length <= 2) return; // Keep at least start and end points

    const newWaypoints = waypoints.filter((wp) => wp.id !== waypointId);
    setWaypoints(newWaypoints);
  };

  const handleWaypointChange = (waypointId: string, field: keyof Waypoint, value: string) => {
    const newWaypoints = waypoints.map((wp) =>
      wp.id === waypointId ? { ...wp, [field]: value } : wp,
    );
    setWaypoints(newWaypoints);

    // Validate that start and end points have names
    const hasValidStartEnd =
      Boolean(newWaypoints[0]?.name?.trim()) &&
      Boolean(newWaypoints[newWaypoints.length - 1]?.name?.trim());
    onValidationChange(hasValidStartEnd);
  };

  const handleGetCurrentLocation = async (waypointId: string) => {
    if (!navigator.geolocation) {
      alert(t('errors.geolocationNotSupported', 'Geolocation is not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const newWaypoints = waypoints.map((wp) =>
          wp.id === waypointId
            ? { ...wp, coordinates: [longitude, latitude] as [number, number] }
            : wp,
        );
        setWaypoints(newWaypoints);
      },
      (error) => {
        console.error('Geolocation error:', error);
        alert(t('errors.geolocationError', 'Failed to get current location'));
      },
    );
  };

  const handleCalculateRoute = async () => {
    setIsCalculating(true);

    try {
      // Simulate route calculation
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const routePoints = waypoints
        .map((wp) =>
          Array.isArray(wp.coordinates)
            ? { coordinates: wp.coordinates, name: wp.name }
            : null
        )
        .filter(
          (wp): wp is { coordinates: [number, number]; name: string } =>
            wp !== null && Array.isArray(wp.coordinates)
        );

      emitUpdate({
        waypoints: routePoints as RouteEntity['waypoints'],
      });
      onValidationChange(true);
    } catch (error) {
      console.error('Route calculation error:', error);
    } finally {
      setIsCalculating(false);
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h6" gutterBottom>
        {t('base-dialog.routeSelection.title', 'Route Selection')}
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {t('base-dialog.routeSelection.description', 'Configure waypoints and route options')}
      </Typography>

      {/* Waypoints */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          {t('base-dialog.routeSelection.waypoints', 'Waypoints')}
        </Typography>

        <Stack spacing={2}>
          {waypoints.map((waypoint, index) => (
            <Box key={waypoint.id} sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Chip
                label={index === 0 ? 'S' : index === waypoints.length - 1 ? 'E' : `${index}`}
                color={
                  index === 0 ? 'success' : index === waypoints.length - 1 ? 'error' : 'primary'
                }
                size="small"
                sx={{ minWidth: 32 }}
              />

              <TextField
                fullWidth
                size="small"
                value={waypoint.name}
                onChange={(e) => handleWaypointChange(waypoint.id, 'name', e.target.value)}
                placeholder={
                  index === 0
                    ? t('base-dialog.routeSelection.startPlaceholder', 'Enter start location')
                    : index === waypoints.length - 1
                      ? t('base-dialog.routeSelection.endPlaceholder', 'Enter destination')
                      : t(
                        'base-dialog.routeSelection.waypointPlaceholder',
                        'Enter waypoint location',
                      )
                }
              />

              <Button
                size="small"
                variant="outlined"
                onClick={() => handleGetCurrentLocation(waypoint.id)}
                startIcon={<MyLocation />}
                sx={{ minWidth: 120 }}
              >
                {t('base-dialog.routeSelection.currentLocation', 'Current')}
              </Button>

              {waypoints.length > 2 && index !== 0 && index !== waypoints.length - 1 && (
                <Button
                  size="small"
                  color="error"
                  onClick={() => handleRemoveWaypoint(waypoint.id)}
                  sx={{ minWidth: 40 }}
                >
                  <Remove />
                </Button>
              )}
            </Box>
          ))}
        </Stack>

        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
          <Button startIcon={<Add />} onClick={handleAddWaypoint} disabled={waypoints.length >= 10}>
            {t('base-dialog.routeSelection.addWaypoint', 'Add Waypoint')}
          </Button>
        </Box>
      </Box>

      {/* Route Options removed for current scope */}

      {/* Route Calculation */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
        <Button
          variant="contained"
          onClick={handleCalculateRoute}
          disabled={isCalculating || !waypoints[0]?.name || !waypoints[waypoints.length - 1]?.name}
          startIcon={isCalculating ? <CircularProgress size={20} /> : null}
        >
          {isCalculating
            ? t('base-dialog.routeSelection.calculating', 'Calculating...')
            : t('base-dialog.routeSelection.calculateRoute', 'Calculate Route')}
        </Button>
      </Box>

      {Array.isArray(draft.waypoints) && draft.waypoints.length > 0 && (
        <Alert severity="success" sx={{ mt: 2 }}>
          {t('base-dialog.routeSelection.routeCalculated', 'Route calculated successfully!')}
        </Alert>
      )}
    </Box>
  );
};
