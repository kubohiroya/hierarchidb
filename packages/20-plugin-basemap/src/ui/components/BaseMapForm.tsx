/**
 * BaseMap Form Component - handles form input and validation
 */

import React from 'react';
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Typography,
  Divider,
  Chip,
  Stack,
  Alert
} from '@mui/material';
import { CreateBaseMapData, MAP_STYLES, VALIDATION_LIMITS } from '../../shared';
import { useBaseMapValidation } from '../hooks';

export interface BaseMapFormProps {
  data: CreateBaseMapData;
  onChange: (updates: Partial<CreateBaseMapData>) => void;
  mode: 'create' | 'edit';
}

/**
 * Form component for BaseMap configuration
 */
export const BaseMapForm: React.FC<BaseMapFormProps> = ({
  data,
  onChange,
  mode: _mode
}) => {
  const { validateCreateData } = useBaseMapValidation();

  // Validate current form data
  const validation = React.useMemo(() => {
    return validateCreateData(data);
  }, [data, validateCreateData]);

  // Handle basic field changes
  const handleFieldChange = (field: keyof CreateBaseMapData) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const value = event.target.value;
    onChange({ [field]: value });
  };

  // Handle select changes
  const handleSelectChange = (field: keyof CreateBaseMapData) => (
    event: { target: { value: unknown } }
  ) => {
    onChange({ [field]: event.target.value });
  };

  // Handle center coordinate changes
  const handleCenterChange = (index: 0 | 1) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = parseFloat(event.target.value) || 0;
    const newCenter: [number, number] = [...data.center];
    newCenter[index] = value;
    onChange({ center: newCenter });
  };

  // Handle numeric field changes
  const handleNumericChange = (field: keyof CreateBaseMapData) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = parseFloat(event.target.value) || 0;
    onChange({ [field]: value });
  };

  // Handle display options
  const handleDisplayOptionChange = (option: string) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    onChange({
      displayOptions: {
        ...data.displayOptions,
        [option]: event.target.checked
      }
    });
  };

  // Handle tags
  const handleTagsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const tags = event.target.value
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
    onChange({ tags });
  };

  return (
    <Box sx={{ p: 2 }}>
      {!validation.isValid && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="body2" component="div">
            Please fix the following errors:
            <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
              {validation.errors.map((error, index) => (
                <li key={index}>{error.message}</li>
              ))}
            </ul>
          </Typography>
        </Alert>
      )}

      {/* Basic Information */}
      <Typography variant="h6" gutterBottom>
        Basic Information
      </Typography>
      
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr', mb: 3 }}>
        <TextField
          label="Name"
          value={data.name}
          onChange={handleFieldChange('name')}
          error={!data.name.trim()}
          helperText={!data.name.trim() ? 'Name is required' : `${data.name.length}/${VALIDATION_LIMITS.NAME_MAX_LENGTH} characters`}
          fullWidth
          required
        />
        
        <TextField
          label="Description"
          value={data.description || ''}
          onChange={handleFieldChange('description')}
          helperText={`${(data.description || '').length}/${VALIDATION_LIMITS.DESCRIPTION_MAX_LENGTH} characters`}
          fullWidth
          multiline
          maxRows={2}
        />
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* Map Style Configuration */}
      <Typography variant="h6" gutterBottom>
        Map Style
      </Typography>
      
      <Box sx={{ mb: 3 }}>
        <FormControl fullWidth>
          <InputLabel>Map Style</InputLabel>
          <Select
            value={data.mapStyle}
            onChange={handleSelectChange('mapStyle')}
            label="Map Style"
          >
            <MenuItem value={MAP_STYLES.STREETS}>Streets</MenuItem>
            <MenuItem value={MAP_STYLES.SATELLITE}>Satellite</MenuItem>
            <MenuItem value={MAP_STYLES.HYBRID}>Hybrid</MenuItem>
            <MenuItem value={MAP_STYLES.TERRAIN}>Terrain</MenuItem>
            <MenuItem value={MAP_STYLES.CUSTOM}>Custom</MenuItem>
          </Select>
        </FormControl>

        {data.mapStyle === 'custom' && (
          <Box sx={{ mt: 2 }}>
            <TextField
              label="Style URL"
              value={data.styleUrl || ''}
              onChange={handleFieldChange('styleUrl')}
              placeholder="https://example.com/style.json"
              helperText="URL to a MapLibre GL style JSON file"
              fullWidth
            />
          </Box>
        )}
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* Map Viewport */}
      <Typography variant="h6" gutterBottom>
        Map Viewport
      </Typography>
      
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr 1fr 1fr', mb: 3 }}>
        <TextField
          label="Longitude"
          type="number"
          value={data.center[0]}
          onChange={handleCenterChange(0)}
          inputProps={{ 
            min: VALIDATION_LIMITS.LONGITUDE_MIN, 
            max: VALIDATION_LIMITS.LONGITUDE_MAX,
            step: 0.000001
          }}
        />
        
        <TextField
          label="Latitude"
          type="number"
          value={data.center[1]}
          onChange={handleCenterChange(1)}
          inputProps={{ 
            min: VALIDATION_LIMITS.LATITUDE_MIN, 
            max: VALIDATION_LIMITS.LATITUDE_MAX,
            step: 0.000001
          }}
        />
        
        <TextField
          label="Zoom Level"
          type="number"
          value={data.zoom}
          onChange={handleNumericChange('zoom')}
          inputProps={{ 
            min: VALIDATION_LIMITS.ZOOM_MIN, 
            max: VALIDATION_LIMITS.ZOOM_MAX,
            step: 0.1
          }}
        />
        
        <TextField
          label="Bearing (°)"
          type="number"
          value={data.bearing || 0}
          onChange={handleNumericChange('bearing')}
          inputProps={{ 
            min: VALIDATION_LIMITS.BEARING_MIN, 
            max: VALIDATION_LIMITS.BEARING_MAX - 1,
            step: 1
          }}
        />
      </Box>

      <TextField
        label="Pitch (°)"
        type="number"
        value={data.pitch || 0}
        onChange={handleNumericChange('pitch')}
        inputProps={{ 
          min: VALIDATION_LIMITS.PITCH_MIN, 
          max: VALIDATION_LIMITS.PITCH_MAX,
          step: 1
        }}
        sx={{ mb: 3, width: '200px' }}
      />

      <Divider sx={{ my: 3 }} />

      {/* Display Options */}
      <Typography variant="h6" gutterBottom>
        Display Options
      </Typography>
      
      <Box sx={{ mb: 3 }}>
        <Stack spacing={1}>
          <FormControlLabel
            control={
              <Switch
                checked={data.displayOptions?.show3dBuildings || false}
                onChange={handleDisplayOptionChange('show3dBuildings')}
              />
            }
            label="Show 3D Buildings"
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={data.displayOptions?.showTraffic || false}
                onChange={handleDisplayOptionChange('showTraffic')}
              />
            }
            label="Show Traffic"
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={data.displayOptions?.showTransit || false}
                onChange={handleDisplayOptionChange('showTransit')}
              />
            }
            label="Show Transit"
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={data.displayOptions?.showTerrain || false}
                onChange={handleDisplayOptionChange('showTerrain')}
              />
            }
            label="Show Terrain"
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={data.displayOptions?.showLabels !== false}
                onChange={handleDisplayOptionChange('showLabels')}
              />
            }
            label="Show Labels"
          />
        </Stack>
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* Additional Settings */}
      <Typography variant="h6" gutterBottom>
        Additional Settings
      </Typography>
      
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr', mb: 3 }}>
        <TextField
          label="API Key"
          type="password"
          value={data.apiKey || ''}
          onChange={handleFieldChange('apiKey')}
          helperText="Optional API key for premium tile providers"
          fullWidth
        />
        
        <TextField
          label="Attribution"
          value={data.attribution || ''}
          onChange={handleFieldChange('attribution')}
          helperText="Custom attribution text"
          fullWidth
        />
      </Box>

      {/* Tags */}
      <TextField
        label="Tags"
        value={data.tags?.join(', ') || ''}
        onChange={handleTagsChange}
        helperText="Comma-separated tags for categorization"
        fullWidth
        sx={{ mb: 2 }}
      />
      
      {data.tags && data.tags.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {data.tags.map((tag, index) => (
              <Chip key={index} label={tag} size="small" />
            ))}
          </Stack>
        </Box>
      )}
    </Box>
  );
};