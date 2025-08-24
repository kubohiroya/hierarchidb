/**
 * Shape Dialog Component - UI Layer
 * Main dialog for creating and editing Shape entities
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stepper,
  Step,
  StepLabel,
  Box,
  Typography,
  CircularProgress
} from '@mui/material';
import { NodeId } from '@hierarchidb/common-core';
import { useShapeAPIGetter } from '../hooks/useShapeAPI';
import { 
  ShapeEntity,
  ShapeWorkingCopy,
  CreateShapeData,
  UpdateShapeData,
  UI_CONSTANTS
} from '../../shared';

export interface ShapeDialogProps {
  mode: 'create' | 'edit';
  nodeId?: NodeId;
  parentNodeId?: NodeId;
  open: boolean;
  onClose: () => void;
  onSuccess?: (entity: ShapeEntity) => void;
  onError?: (error: Error) => void;
}

export function ShapeDialog({
  mode,
  nodeId,
  parentNodeId,
  open,
  onClose,
  onSuccess,
  onError
}: ShapeDialogProps) {
  const getShapeAPI = useShapeAPIGetter();
  
  // State management
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [workingCopy, setWorkingCopy] = useState<ShapeWorkingCopy | null>(null);
  const [initializing, setInitializing] = useState(false);

  // ✅ For Step 1, use temporary state (no WorkingCopy yet)
  const initializeTempState = useCallback(() => {
    const tempState: ShapeWorkingCopy = {
      id: 'temp-id' as any,
      nodeId: nodeId || parentNodeId as any,
      name: '',
      description: '',
      dataSourceName: 'naturalearth',
      licenseAgreement: false,
      processingConfig: {
        concurrentDownloads: 2,
        corsProxyBaseURL: '',
        enableFeatureFiltering: false,
        featureFilterMethod: 'hybrid',
        featureAreaThreshold: 0.1,
        concurrentProcesses: 2,
        maxZoomLevel: 12
      },
      checkboxState: '',
      selectedCountries: [],
      adminLevels: [],
      urlMetadata: [],
      isDraft: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };
    setWorkingCopy(tempState);
  }, [nodeId, parentNodeId]);

  // Initialize temp state for Step 1 only
  useEffect(() => {
    if (open && !workingCopy && !initializing && activeStep === 0) {
      initializeTempState();
    }
  }, [open, activeStep, workingCopy, initializing, initializeTempState]);

  // ✅ Step-based initialization - Only create WorkingCopy at Step 2
  const initializeWorkingCopyForStep2 = useCallback(async () => {
    if (initializing || workingCopy) return;
    
    setInitializing(true);
    try {
      const api = await getShapeAPI();
      
      if (mode === 'edit' && nodeId) {
        // ✅ CopyOnWrite: Create working copy from existing entity
        const workingCopyId = await api.createWorkingCopy(nodeId);
        const workingCopyData = await api.getWorkingCopy(workingCopyId);
        if (workingCopyData) {
          setWorkingCopy(workingCopyData as ShapeWorkingCopy);
        }
      } else if (mode === 'create' && parentNodeId) {
        // ✅ New draft: Create working copy for new entity
        const workingCopyId = await api.createNewDraftWorkingCopy(parentNodeId);
        const workingCopyData = await api.getWorkingCopy(workingCopyId);
        if (workingCopyData) {
          setWorkingCopy(workingCopyData as ShapeWorkingCopy);
        }
      }
    } catch (error) {
      console.error('Failed to initialize working copy:', error);
      onError?.(error instanceof Error ? error : new Error('Failed to initialize working copy'));
    } finally {
      setInitializing(false);
    }
  }, [mode, nodeId, parentNodeId, getShapeAPI, onError, initializing, workingCopy]);



  const handleNext = useCallback(async () => {
    // ✅ Step 1 → Step 2: Create actual WorkingCopy (CopyOnWrite)
    if (activeStep === 1 && !initializing && workingCopy?.id === 'temp-id') {
      await initializeWorkingCopyForStep2();
    }
    
    setActiveStep((prev) => Math.min(prev + 1, UI_CONSTANTS.STEPPER_STEPS.length - 1));
  }, [activeStep, initializing, workingCopy, initializeWorkingCopyForStep2]);

  const handleBack = useCallback(() => {
    setActiveStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleUpdateWorkingCopy = useCallback((updates: Partial<ShapeWorkingCopy>) => {
    setWorkingCopy((prev) => prev ? { ...prev, ...updates } : null);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!workingCopy) return;

    setLoading(true);
    try {
      const api = await getShapeAPI();

      if (mode === 'create') {
        const createData: CreateShapeData = {
          name: workingCopy.name,
          description: workingCopy.description,
          dataSourceName: workingCopy.dataSourceName,
          processingConfig: workingCopy.processingConfig,
        };

        const entity = await api.createEntity(parentNodeId as NodeId, createData);
        onSuccess?.(entity);
      } else if (mode === 'edit' && nodeId) {
        const updateData: UpdateShapeData = {
          name: workingCopy.name,
          description: workingCopy.description,
          processingConfig: workingCopy.processingConfig,
          selectedCountries: workingCopy.selectedCountries,
          adminLevels: workingCopy.adminLevels,
          urlMetadata: workingCopy.urlMetadata,
        };

        await api.updateEntity(nodeId, updateData);
        const updatedEntity = await api.getEntity(nodeId);
        if (updatedEntity) {
          onSuccess?.(updatedEntity);
        }
      }

      onClose();
    } catch (error) {
      console.error('Failed to submit shape:', error);
      onError?.(error instanceof Error ? error : new Error('Failed to submit'));
    } finally {
      setLoading(false);
    }
  }, [mode, workingCopy, nodeId, parentNodeId, getShapeAPI, onSuccess, onError, onClose]);

  const handleClose = useCallback(() => {
    setActiveStep(0);
    setWorkingCopy(null);
    setInitializing(false);
    onClose();
  }, [onClose]);

  const isStepComplete = useCallback((step: number) => {
    if (!workingCopy) return false;

    switch (step) {
      case 0: // Basic Information
        return workingCopy.name.trim().length > 0;
      case 1: // Data Source
        return !!workingCopy.dataSourceName;
      case 2: // License Agreement
        return workingCopy.licenseAgreement;
      case 3: // Processing Configuration
        return !!workingCopy.processingConfig;
      case 4: // Country Selection
        return workingCopy.selectedCountries.length > 0 && workingCopy.adminLevels.length > 0;
      default:
        return false;
    }
  }, [workingCopy]);

  const canProceed = isStepComplete(activeStep);
  const isLastStep = activeStep === UI_CONSTANTS.STEPPER_STEPS.length - 1;
  const canSubmit = UI_CONSTANTS.STEPPER_STEPS.every((_, index) => isStepComplete(index));

  if (initializing) {
    return (
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogContent>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
            <CircularProgress />
            <Typography variant="body2" sx={{ ml: 2 }}>
              Initializing shape dialog...
            </Typography>
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth={UI_CONSTANTS.DIALOG_MAX_WIDTH as any} 
      fullWidth
      PaperProps={{
        sx: { minHeight: '70vh' }
      }}
    >
      <DialogTitle>
        {mode === 'create' ? 'Create Shape' : 'Edit Shape'}
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ width: '100%', mb: 3 }}>
          <Stepper activeStep={activeStep} alternativeLabel>
            {UI_CONSTANTS.STEPPER_STEPS.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>

        {workingCopy && (
          <Box sx={{ mt: 2 }}>
            {/* Step content would be rendered here */}
            {activeStep === 0 && (
              <Box>
                <Typography variant="h6" gutterBottom>
                  Basic Information
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Enter basic information for your shape data source.
                </Typography>
                
                {/* Basic form fields would go here */}
                <Typography variant="body2">
                  Current name: {workingCopy.name || '(empty)'}
                </Typography>
                <Typography variant="body2">
                  Description: {workingCopy.description || '(empty)'}
                </Typography>
              </Box>
            )}
            
            {activeStep === 1 && (
              <Box>
                <Typography variant="h6" gutterBottom>
                  Data Source Selection
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Choose your geographic data source.
                </Typography>
                <Typography variant="body2">
                  Selected: {workingCopy.dataSourceName}
                </Typography>
              </Box>
            )}
            
            {activeStep === 2 && (
              <Box>
                <Typography variant="h6" gutterBottom>
                  License Agreement
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Please review and accept the data source license.
                </Typography>
                <Typography variant="body2">
                  License accepted: {workingCopy.licenseAgreement ? 'Yes' : 'No'}
                </Typography>
              </Box>
            )}
            
            {activeStep === 3 && (
              <Box>
                <Typography variant="h6" gutterBottom>
                  Processing Configuration
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Configure processing parameters.
                </Typography>
                <Typography variant="body2">
                  Max zoom: {workingCopy.processingConfig.maxZoomLevel}
                </Typography>
              </Box>
            )}
            
            {activeStep === 4 && (
              <Box>
                <Typography variant="h6" gutterBottom>
                  Country Selection
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Select countries and administrative levels.
                </Typography>
                <Typography variant="body2">
                  Countries: {workingCopy.selectedCountries.length}
                </Typography>
                <Typography variant="body2">
                  Admin levels: {workingCopy.adminLevels.length}
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        
        <Box sx={{ flex: 1 }} />
        
        {activeStep > 0 && (
          <Button onClick={handleBack} disabled={loading}>
            Back
          </Button>
        )}
        
        {!isLastStep && (
          <Button 
            onClick={handleNext} 
            disabled={!canProceed || loading}
            variant="contained"
          >
            Next
          </Button>
        )}
        
        {isLastStep && (
          <Button 
            onClick={handleSubmit} 
            disabled={!canSubmit || loading}
            variant="contained"
          >
            {loading && <CircularProgress size={16} sx={{ mr: 1 }} />}
            {mode === 'create' ? 'Create' : 'Update'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}