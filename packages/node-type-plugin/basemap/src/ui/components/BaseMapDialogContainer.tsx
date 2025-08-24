/**
 * BaseMap Dialog Container - integrates with new 3-layer architecture
 */

import React, { useState, useCallback } from 'react';
import { NodeId } from '@hierarchidb/common-core';
import { 
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
  Alert,
  Box
} from '@mui/material';
import { 
  CreateBaseMapData, 
  UpdateBaseMapData, 
  BaseMapEntity,
  DEFAULT_MAP_CONFIG
} from '../../shared';
import { useBaseMapData, useBaseMapValidation } from '../hooks';
import { BaseMapForm } from './BaseMapForm';
import { BaseMapPreview } from './BaseMapPreview';

export interface BaseMapDialogContainerProps {
  nodeId: NodeId;
  open: boolean;
  onClose: () => void;
  onSuccess?: (entity: BaseMapEntity) => void;
  mode?: 'create' | 'edit';
}

/**
 * Container component that manages BaseMap dialog state and API integration
 */
export const BaseMapDialogContainer: React.FC<BaseMapDialogContainerProps> = ({
  nodeId,
  open,
  onClose,
  onSuccess,
  mode = 'create'
}) => {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<CreateBaseMapData>({
    name: '',
    description: '',
    mapStyle: 'streets',
    center: DEFAULT_MAP_CONFIG.center!,
    zoom: DEFAULT_MAP_CONFIG.zoom!,
    bearing: DEFAULT_MAP_CONFIG.bearing,
    pitch: DEFAULT_MAP_CONFIG.pitch,
    displayOptions: DEFAULT_MAP_CONFIG.displayOptions,
  });

  const { entity, loading, error, create, update } = useBaseMapData(nodeId);
  const { validateCreateData, validateUpdateData } = useBaseMapValidation();

  // Initialize form data from entity when editing
  React.useEffect(() => {
    if (mode === 'edit' && entity && open) {
      setFormData({
        name: entity.name,
        description: entity.description,
        mapStyle: entity.mapStyle,
        styleUrl: entity.styleUrl,
        styleConfig: entity.styleConfig,
        center: entity.center,
        zoom: entity.zoom,
        bearing: entity.bearing,
        pitch: entity.pitch,
        bounds: entity.bounds,
        displayOptions: entity.displayOptions,
        apiKey: entity.apiKey,
        attribution: entity.attribution,
        tags: entity.tags,
      });
    }
  }, [mode, entity, open]);

  // Handle form data updates
  const handleFormChange = useCallback((updates: Partial<CreateBaseMapData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    try {
      let result: BaseMapEntity;
      
      if (mode === 'create') {
        // Validate create data
        const validation = validateCreateData(formData);
        if (!validation.isValid) {
          throw new Error(validation.errors.join(', '));
        }
        
        result = await create(formData);
      } else {
        // Validate update data
        const updateData: UpdateBaseMapData = formData;
        const validation = validateUpdateData(updateData);
        if (!validation.isValid) {
          throw new Error(validation.errors.join(', '));
        }
        
        await update(updateData);
        result = entity!; // Entity is guaranteed to exist in edit mode
      }

      onSuccess?.(result);
      onClose();
    } catch (err) {
      // Error handling is done by the hooks, just log here
      console.error('BaseMap submit error:', err);
    }
  }, [mode, formData, create, update, entity, validateCreateData, validateUpdateData, onSuccess, onClose]);

  // Handle dialog close
  const handleClose = useCallback(() => {
    setStep(0);
    if (mode === 'create') {
      setFormData({
        name: '',
        description: '',
        mapStyle: 'streets',
        center: DEFAULT_MAP_CONFIG.center!,
        zoom: DEFAULT_MAP_CONFIG.zoom!,
        bearing: DEFAULT_MAP_CONFIG.bearing,
        pitch: DEFAULT_MAP_CONFIG.pitch,
        displayOptions: DEFAULT_MAP_CONFIG.displayOptions,
      });
    }
    onClose();
  }, [mode, onClose]);

  const dialogTitle = mode === 'create' ? 'Create Base Map' : 'Edit Base Map';

  if (loading && mode === 'edit') {
    return (
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogContent>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
            <CircularProgress />
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { height: '80vh', maxHeight: '800px' }
      }}
    >
      <DialogTitle>{dialogTitle}</DialogTitle>
      
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        {step === 0 && (
          <BaseMapForm
            data={formData}
            onChange={handleFormChange}
            mode={mode}
          />
        )}
        
        {step === 1 && (
          <BaseMapPreview
            data={formData}
            onDataChange={handleFormChange}
          />
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={handleClose}>
          Cancel
        </Button>
        
        {step > 0 && (
          <Button onClick={() => setStep(step - 1)}>
            Previous
          </Button>
        )}
        
        {step < 1 ? (
          <Button 
            variant="contained" 
            onClick={() => setStep(step + 1)}
            disabled={!formData.name.trim()}
          >
            Next
          </Button>
        ) : (
          <Button 
            variant="contained" 
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : (mode === 'create' ? 'Create' : 'Update')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};