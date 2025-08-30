import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stepper,
  Step,
  StepLabel,
  Button,
  Box,
  Typography
} from '@mui/material';
import type { NodeId } from '@hierarchidb/common-type';
import type { ProjectEntity } from '~/types/project-types';
import { BasicInfoStep } from './steps/BasicInfoStep';
import { RegionConfigStep } from './steps/RegionConfigStep';
import { LayerConfigStep } from './steps/LayerConfigStep';
import { SpatialAnalysisStep } from './steps/SpatialAnalysisStep';
import { TemporalAnalysisStep } from './steps/TemporalAnalysisStep';
import { OutputConfigStep } from './steps/OutputConfigStep';

export interface ProjectWizardProps {
  open: boolean;
  nodeId: NodeId;
  initialData?: Partial<ProjectEntity>;
  onClose: () => void;
  onComplete: (data: Partial<ProjectEntity>) => Promise<void>;
}

const steps = [
  'Basic Information',
  'Target Region',
  'Data Layers',
  'Spatial Analysis',
  'Temporal Analysis',
  'Output Settings'
];

export const ProjectWizard: React.FC<ProjectWizardProps> = ({
  open,
  nodeId,
  initialData,
  onClose,
  onComplete
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [projectData, setProjectData] = useState<Partial<ProjectEntity>>(
    initialData || {}
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNext = () => {
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleStepComplete = (stepData: any) => {
    setProjectData((prev) => ({
      ...prev,
      ...stepData
    }));
    
    if (activeStep === steps.length - 1) {
      handleSubmit();
    } else {
      handleNext();
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onComplete(projectData);
      onClose();
    } catch (error) {
      console.error('Failed to create project:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <BasicInfoStep
            data={projectData}
            onComplete={handleStepComplete}
          />
        );
      case 1:
        return (
          <RegionConfigStep
            data={projectData}
            onComplete={handleStepComplete}
          />
        );
      case 2:
        return (
          <LayerConfigStep
            data={projectData}
            nodeId={nodeId}
            onComplete={handleStepComplete}
          />
        );
      case 3:
        return (
          <SpatialAnalysisStep
            data={projectData}
            onComplete={handleStepComplete}
          />
        );
      case 4:
        return (
          <TemporalAnalysisStep
            data={projectData}
            onComplete={handleStepComplete}
          />
        );
      case 5:
        return (
          <OutputConfigStep
            data={projectData}
            onComplete={handleStepComplete}
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
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { height: '90vh', display: 'flex', flexDirection: 'column' }
      }}
    >
      <DialogTitle>
        <Typography variant="h5">Create Project</Typography>
      </DialogTitle>
      
      <DialogContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
        
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {renderStepContent()}
        </Box>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleBack}
          disabled={activeStep === 0}
        >
          Back
        </Button>
        {activeStep === steps.length - 1 ? (
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            Create Project
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleNext}
          >
            Next
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};