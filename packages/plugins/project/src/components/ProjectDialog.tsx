/**
 * Project Plugin - Main Dialog Component
 * Multi-step dialog for creating and editing project nodes
 */

import type React from 'react';
import { useState, useCallback } from 'react';
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
  IconButton,
} from '@mui/material';
import {
  Close as CloseIcon,
  Map as MapIcon,
} from '@mui/icons-material';
import type { NodeId } from '@hierarchidb/00-core';
import type { ProjectEntity, CreateProjectData, UpdateProjectData } from '../types';

// Step components
import { Step1BasicInformation } from './steps/Step1BasicInformation';
import { Step2MapConfiguration } from './steps/Step2MapConfiguration';
import { Step3ResourceReferences } from './steps/Step3ResourceReferences';
import { Step4LayerConfiguration } from './steps/Step4LayerConfiguration';
import { Step5Preview } from './steps/Step5Preview';

/**
 * Props for ProjectDialog
 */
export interface ProjectDialogProps {
  open: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  nodeId?: NodeId;
  initialData?: Partial<ProjectEntity>;
  onSave: (data: CreateProjectData | UpdateProjectData) => Promise<void>;
  onCancel: () => void;
}

/**
 * Step configuration
 */
const STEPS = [
  {
    id: 'basic',
    label: 'Basic Information',
    description: 'Project name and description',
  },
  {
    id: 'map',
    label: 'Map Configuration',
    description: 'Initial map view settings',
  },
  {
    id: 'resources',
    label: 'Resource References',
    description: 'Select resources to include',
  },
  {
    id: 'layers',
    label: 'Layer Configuration',
    description: 'Configure layer display',
  },
  {
    id: 'preview',
    label: 'Preview',
    description: 'Review and confirm',
  },
];

/**
 * Project Dialog Component
 */
export const ProjectDialog: React.FC<ProjectDialogProps> = ({
  open,
  onClose,
  mode,
  nodeId,
  initialData,
  onSave,
  onCancel,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [projectData, setProjectData] = useState<Partial<CreateProjectData>>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    ...(initialData?.mapConfig && { mapConfig: initialData.mapConfig }),
    ...(initialData?.renderConfig && { renderConfig: initialData.renderConfig }),
    initialReferences: [],
  });
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Handle next step
   */
  const handleNext = useCallback(() => {
    if (activeStep < STEPS.length - 1) {
      setActiveStep(prev => prev + 1);
    }
  }, [activeStep]);

  /**
   * Handle previous step
   */
  const handleBack = useCallback(() => {
    if (activeStep > 0) {
      setActiveStep(prev => prev - 1);
    }
  }, [activeStep]);

  /**
   * Handle data update
   */
  const handleDataUpdate = useCallback((updates: Partial<CreateProjectData>) => {
    setProjectData(prev => ({ ...prev, ...updates }));
  }, []);

  /**
   * Handle save
   */
  const handleSave = useCallback(async () => {
    setIsLoading(true);
    try {
      await onSave(projectData as CreateProjectData);
      onClose();
    } catch (error) {
      console.error('Failed to save project:', error);
      // TODO: Show error notification
    } finally {
      setIsLoading(false);
    }
  }, [projectData, onSave, onClose]);

  /**
   * Handle cancel
   */
  const handleCancel = useCallback(() => {
    onCancel();
    onClose();
  }, [onCancel, onClose]);

  /**
   * Reset dialog state when closed
   */
  const handleClose = useCallback(() => {
    setActiveStep(0);
    setProjectData({
      name: '',
      description: '',
      initialReferences: [],
    });
    onClose();
  }, [onClose]);

  /**
   * Check if current step is valid
   */
  const isStepValid = useCallback(() => {
    switch (activeStep) {
      case 0: // Basic Information
        return projectData.name && projectData.name.trim().length > 0;
      case 1: // Map Configuration
        return true; // Optional step
      case 2: // Resource References
        return true; // Optional step
      case 3: // Layer Configuration
        return true; // Optional step
      case 4: // Preview
        return true;
      default:
        return false;
    }
  }, [activeStep, projectData]);

  /**
   * Render step content
   */
  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Step1BasicInformation
            data={projectData}
            onChange={handleDataUpdate}
          />
        );
      case 1:
        return (
          <Step2MapConfiguration
            data={projectData}
            onChange={handleDataUpdate}
          />
        );
      case 2:
        return (
          <Step3ResourceReferences
            data={projectData}
            onChange={handleDataUpdate}
            projectNodeId={nodeId || ('' as NodeId)}
          />
        );
      case 3:
        return (
          <Step4LayerConfiguration
            data={projectData}
            onChange={handleDataUpdate}
          />
        );
      case 4:
        return (
          <Step5Preview
            data={projectData}
            mode={mode}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: 600 }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <MapIcon color="primary" />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            {mode === 'create' ? 'Create Project' : 'Edit Project'}
          </Typography>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {/* Stepper */}
        <Box mb={3}>
          <Stepper activeStep={activeStep} alternativeLabel>
            {STEPS.map((step) => (
              <Step key={step.id}>
                <StepLabel>
                  <Typography variant="body2" fontWeight="medium">
                    {step.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {step.description}
                  </Typography>
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>

        {/* Step Content */}
        <Box minHeight={300}>
          {renderStepContent()}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button
          onClick={handleCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        
        <Box sx={{ flex: '1 1 auto' }} />
        
        <Button
          onClick={handleBack}
          disabled={activeStep === 0 || isLoading}
        >
          Back
        </Button>
        
        {activeStep === STEPS.length - 1 ? (
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={!isStepValid() || isLoading}
          >
            {isLoading ? 'Saving...' : mode === 'create' ? 'Create Project' : 'Save Changes'}
          </Button>
        ) : (
          <Button
            onClick={handleNext}
            variant="contained"
            disabled={!isStepValid() || isLoading}
          >
            Next
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ProjectDialog;