/**
 * @file BaseMapStepperDialog.tsx
 * @description Stepper dialog for BaseMap creation/editing
 */

import React, { useState, useCallback } from 'react';
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
  IconButton,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import type { BaseMapEntity, BaseMapWorkingCopy } from '../types';
import type { NodeId } from '@hierarchidb/00-core';
import { Step1BasicInformation } from './steps/Step1BasicInformation';
import { Step2MapStyle } from './steps/Step2MapStyle';
import { Step3MapView } from './steps/Step3MapView';
import { Step4Preview } from './steps/Step4Preview';

export interface BaseMapStepperDialogProps {
  open: boolean;
  nodeId?: NodeId;
  entity?: BaseMapEntity;
  workingCopy?: BaseMapWorkingCopy;
  onClose: () => void;
  onSave: (data: Partial<BaseMapEntity>) => void;
  mode?: 'create' | 'edit';
}

const steps = [
  'Basic Information',
  'Map Style',
  'View Settings',
  'Preview',
];

interface FormData {
  name: string;
  description: string;
  mapStyle: BaseMapEntity['mapStyle'];
  styleUrl: string;
  apiKey: string;
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
  displayOptions: BaseMapEntity['displayOptions'];
}

const defaultFormData: FormData = {
  name: '',
  description: '',
  mapStyle: 'streets',
  styleUrl: '',
  apiKey: '',
  center: [0, 0],
  zoom: 10,
  bearing: 0,
  pitch: 0,
  displayOptions: {
    show3dBuildings: false,
    showTraffic: false,
    showTransit: false,
    showTerrain: false,
    showLabels: true,
  },
};

export const BaseMapStepperDialog: React.FC<BaseMapStepperDialogProps> = ({
  open,
  entity,
  workingCopy,
  onClose,
  onSave,
  mode = 'create',
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState<FormData>(() => {
    const baseData = workingCopy || entity;
    if (baseData) {
      return {
        name: baseData.name || '',
        description: baseData.description || '',
        mapStyle: baseData.mapStyle,
        styleUrl: baseData.styleUrl || '',
        apiKey: baseData.apiKey || '',
        center: baseData.center,
        zoom: baseData.zoom,
        bearing: baseData.bearing,
        pitch: baseData.pitch,
        displayOptions: baseData.displayOptions || defaultFormData.displayOptions,
      };
    }
    return defaultFormData;
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const validateStep = useCallback((step: number): boolean => {
    const newErrors: typeof errors = {};

    switch (step) {
      case 0: // Basic Information
        if (!formData.name.trim()) {
          newErrors.name = 'Map name is required';
        }
        break;
      case 1: // Map Style
        if (formData.mapStyle === 'custom' && !formData.styleUrl.trim()) {
          newErrors.styleUrl = 'Style URL is required for custom style';
        }
        break;
      case 2: // View Settings
        if (formData.center[0] < -180 || formData.center[0] > 180) {
          newErrors.center = 'Longitude must be between -180 and 180';
        }
        if (formData.center[1] < -90 || formData.center[1] > 90) {
          newErrors.center = 'Latitude must be between -90 and 90';
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleNext = () => {
    if (validateStep(activeStep)) {
      setActiveStep((prevStep) => prevStep + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  const handleSave = () => {
    if (validateStep(activeStep)) {
      const saveData: Partial<BaseMapEntity> = {
        name: formData.name,
        description: formData.description,
        mapStyle: formData.mapStyle,
        center: formData.center,
        zoom: formData.zoom,
        bearing: formData.bearing,
        pitch: formData.pitch,
        displayOptions: formData.displayOptions,
      };

      if (formData.styleUrl) {
        saveData.styleUrl = formData.styleUrl;
      }
      if (formData.apiKey) {
        saveData.apiKey = formData.apiKey;
      }

      onSave(saveData);
    }
  };

  const updateFormData = (updates: Partial<FormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
    setErrors(prev => {
      const newErrors = { ...prev };
      // Clear errors for updated fields
      Object.keys(updates).forEach(key => {
        delete newErrors[key as keyof FormData];
      });
      return newErrors;
    });
  };

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Step1BasicInformation
            name={formData.name}
            description={formData.description}
            onNameChange={(name) => updateFormData({ name })}
            onDescriptionChange={(description) => updateFormData({ description })}
            nameError={errors.name}
            descriptionError={errors.description}
          />
        );
      case 1:
        return (
          <Step2MapStyle
            mapStyle={formData.mapStyle}
            styleUrl={formData.styleUrl}
            apiKey={formData.apiKey}
            onMapStyleChange={(mapStyle) => updateFormData({ mapStyle })}
            onStyleUrlChange={(styleUrl) => updateFormData({ styleUrl })}
            onApiKeyChange={(apiKey) => updateFormData({ apiKey })}
          />
        );
      case 2:
        return (
          <Step3MapView
            center={formData.center}
            zoom={formData.zoom}
            bearing={formData.bearing}
            pitch={formData.pitch}
            displayOptions={formData.displayOptions}
            onCenterChange={(center) => updateFormData({ center })}
            onZoomChange={(zoom) => updateFormData({ zoom })}
            onBearingChange={(bearing) => updateFormData({ bearing })}
            onPitchChange={(pitch) => updateFormData({ pitch })}
            onDisplayOptionsChange={(displayOptions) => updateFormData({ displayOptions })}
          />
        );
      case 3:
        return (
          <Step4Preview
            name={formData.name}
            description={formData.description}
            mapStyle={formData.mapStyle}
            center={formData.center}
            zoom={formData.zoom}
            bearing={formData.bearing}
            pitch={formData.pitch}
            displayOptions={formData.displayOptions}
            styleUrl={formData.styleUrl}
            apiKey={formData.apiKey}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { height: '80vh', maxHeight: 800 }
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {mode === 'create' ? 'Create Base Map' : 'Edit Base Map'}
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0, overflow: 'hidden' }}>
        <Box sx={{ p: 3, pb: 1 }}>
          <Stepper activeStep={activeStep} alternativeLabel>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>

        <Box sx={{ 
          height: 'calc(100% - 80px)', 
          overflow: 'auto',
          '& > div': { minHeight: '100%' }
        }}>
          {renderStepContent(activeStep)}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>
          Cancel
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button
          disabled={activeStep === 0}
          onClick={handleBack}
          sx={{ mr: 1 }}
        >
          Back
        </Button>
        {activeStep === steps.length - 1 ? (
          <Button
            variant="contained"
            onClick={handleSave}
            color="primary"
          >
            {mode === 'create' ? 'Create Map' : 'Save Changes'}
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleNext}
            color="primary"
          >
            Next
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};