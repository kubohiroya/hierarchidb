/**
 * @file DisplayOptionsStep.tsx
 * @description Display Options step component for BaseMap extension dialog
 * Simplified to work with the plugin extension system
 */

import React, { useState } from 'react';
import { 
  Box, 
  FormControl, 
  FormLabel, 
  FormGroup, 
  FormControlLabel, 
  Checkbox, 
  TextField, 
  Typography, 
  Chip, 
  Stack,
  Alert
} from '@mui/material';

export interface DisplayOptionsStepProps {
  data: any;
  onNext: (data: any) => void;
  onPrevious: () => void;
  errors?: string[];
}

export const DisplayOptionsStep: React.FC<DisplayOptionsStepProps> = ({
  data,
  onNext,
  errors = []
}) => {
  const [displayOptions, setDisplayOptions] = useState({
    show3dBuildings: data.displayOptions?.show3dBuildings || false,
    showTraffic: data.displayOptions?.showTraffic || false,
    showTransit: data.displayOptions?.showTransit || false,
    showTerrain: data.displayOptions?.showTerrain || false,
    showLabels: data.displayOptions?.showLabels || true,
  });
  
  const [attribution, setAttribution] = useState(data.displayOptions?.attribution || '');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(data.displayOptions?.tags || []);

  const updateDisplayOptions = (newOptions: any, newAttribution?: string, newTags?: string[]) => {
    const newData = {
      ...data,
      displayOptions: {
        ...newOptions,
        attribution: newAttribution !== undefined ? newAttribution : attribution,
        tags: newTags !== undefined ? newTags : tags
      }
    };
    onNext(newData);
  };

  const handleDisplayOptionChange = (option: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const newOptions = {
      ...displayOptions,
      [option]: event.target.checked
    };
    setDisplayOptions(newOptions);
    updateDisplayOptions(newOptions);
  };

  const handleAttributionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newAttribution = event.target.value;
    setAttribution(newAttribution);
    updateDisplayOptions(displayOptions, newAttribution);
  };

  const handleTagInputKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addTag();
    }
  };

  const addTag = () => {
    const trimmedTag = tagInput.trim();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      const newTags = [...tags, trimmedTag];
      setTags(newTags);
      setTagInput('');
      updateDisplayOptions(displayOptions, attribution, newTags);
    }
  };

  const removeTag = (tagToRemove: string) => {
    const newTags = tags.filter(tag => tag !== tagToRemove);
    setTags(newTags);
    updateDisplayOptions(displayOptions, attribution, newTags);
  };

  return (
    <Box sx={{ p: 2, maxWidth: 600 }}>
      <Typography variant="h6" gutterBottom>
        Display Options
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure which map layers and elements to display on your base map.
      </Typography>

      {errors.length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errors.map((error, index) => (
            <div key={index}>{error}</div>
          ))}
        </Alert>
      )}

      <FormControl component="fieldset" sx={{ mb: 3, width: '100%' }}>
        <FormLabel component="legend">Map Layers</FormLabel>
        <FormGroup sx={{ mt: 1 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={displayOptions.show3dBuildings}
                onChange={handleDisplayOptionChange('show3dBuildings')}
              />
            }
            label="3D Buildings"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={displayOptions.showTraffic}
                onChange={handleDisplayOptionChange('showTraffic')}
              />
            }
            label="Traffic Information"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={displayOptions.showTransit}
                onChange={handleDisplayOptionChange('showTransit')}
              />
            }
            label="Transit Lines"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={displayOptions.showTerrain}
                onChange={handleDisplayOptionChange('showTerrain')}
              />
            }
            label="Terrain Elevation"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={displayOptions.showLabels}
                onChange={handleDisplayOptionChange('showLabels')}
              />
            }
            label="Map Labels"
          />
        </FormGroup>
      </FormControl>

      <TextField
        fullWidth
        label="Attribution (Optional)"
        value={attribution}
        onChange={handleAttributionChange}
        placeholder="Custom attribution text"
        helperText="Additional attribution text to display on the map"
        sx={{ mb: 3 }}
      />

      <Box sx={{ mb: 2 }}>
        <FormLabel>Tags (Optional)</FormLabel>
        <TextField
          fullWidth
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyPress={handleTagInputKeyPress}
          onBlur={addTag}
          placeholder="Add tags to categorize this base map"
          helperText="Press Enter or comma to add tags"
          sx={{ mt: 1 }}
        />
        {tags.length > 0 && (
          <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap', gap: 1 }}>
            {tags.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                onDelete={() => removeTag(tag)}
                size="small"
                color="primary"
                variant="outlined"
              />
            ))}
          </Stack>
        )}
      </Box>
    </Box>
  );
};