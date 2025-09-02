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
  IconButton,
  Typography,
  Alert,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import type { NodeId } from '@hierarchidb/common-type';
import type { 
  ResolverEntity,
  ResolverWorkingCopyEntity,
  SchemaInfo,
  MappingValidationResult
} from '~/types';

// Step components
import { ResolverBasicInfoStep } from './steps/ResolverBasicInfoStep';
import { SchemaSelectionStep } from './steps/SchemaSelectionStep';
import { PropertyMappingStep } from './steps/PropertyMappingStep';
import { ValidationConfigStep } from './steps/ValidationConfigStep';
import { DuplicateResolutionStep } from './steps/DuplicateResolutionStep';
import { PreviewTestStep } from './steps/PreviewTestStep';

interface ResolverDialogProps {
  open: boolean;
  nodeId: NodeId;
  entity?: ResolverEntity;
  onClose: () => void;
  onSave: (entity: Partial<ResolverWorkingCopyEntity>) => Promise<void>;
  onCancel: () => void;
}

const STEPS = [
  'Basic Information',
  'Schema Selection', 
  'Property Mapping',
  'Validation Rules',
  'Duplicate Resolution',
  'Preview & Test'
];

interface StepValidation {
  [key: number]: boolean;
}

export const ResolverDialog: React.FC<ResolverDialogProps> = ({
  open,
  nodeId,
  entity,
  onClose,
  onSave,
  onCancel,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [workingCopy, setWorkingCopy] = useState<Partial<ResolverWorkingCopyEntity>>({});
  const [stepValidation, setStepValidation] = useState<StepValidation>({});
  const [sourceSchema, setSourceSchema] = useState<SchemaInfo | null>(null);
  const [targetSchema, setTargetSchema] = useState<SchemaInfo | null>(null);
  const [validationResult, setValidationResult] = useState<MappingValidationResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasCompletedOnce, setHasCompletedOnce] = useState(false);

  // Initialize working copy from entity
  useEffect(() => {
    if (entity) {
      setWorkingCopy({
        ...entity,
        mappingRules: entity.mappingRules.map(rule => ({ ...rule })),
        validationRules: entity.validationRules.map(rule => ({ ...rule })),
        duplicateResolution: { ...entity.duplicateResolution },
        dataTransformations: entity.dataTransformations.map(transform => ({ ...transform })),
        previewConfig: entity.previewConfig ? { ...entity.previewConfig } : {
          sampleSize: 100,
          refreshInterval: 1000,
          highlightMappings: true,
          showValidationErrors: true
        }
      });
    } else {
      // Initialize for new entity
      setWorkingCopy({
        nodeId,
        name: '',
        description: '',
        sourceSchema: '',
        targetSchema: '',
        mappingRules: [],
        validationRules: [],
        duplicateResolution: { strategy: 'ignore' },
        dataTransformations: [],
        previewConfig: {
          sampleSize: 100,
          refreshInterval: 1000,
          highlightMappings: true,
          showValidationErrors: true
        }
      });
    }
  }, [entity, nodeId]);

  const updateWorkingCopy = useCallback(
    (updates: Partial<ResolverWorkingCopyEntity>) => {
      setWorkingCopy(prev => ({ ...prev, ...updates }));
    },
    []
  );

  const handleStepValidation = useCallback((step: number, isValid: boolean) => {
    setStepValidation(prev => ({ ...prev, [step]: isValid }));
  }, []);

  const handleNext = useCallback(() => {
    if (activeStep < STEPS.length - 1) {
      setActiveStep(activeStep + 1);
    } else {
      // Completed all steps
      setHasCompletedOnce(true);
    }
  }, [activeStep]);

  const handleBack = useCallback(() => {
    if (activeStep > 0) {
      setActiveStep(activeStep - 1);
    }
  }, [activeStep]);

  // Hybrid navigation: allow free movement after completing once
  const handleStepClick = useCallback((step: number) => {
    if (hasCompletedOnce || step <= activeStep) {
      setActiveStep(step);
    }
  }, [hasCompletedOnce, activeStep]);

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    
    setIsSaving(true);
    try {
      await onSave(workingCopy);
      onClose();
    } catch (error) {
      console.error('Failed to save Resolver:', error);
      // TODO: Show error notification
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, workingCopy, onSave, onClose]);

  const handleCancel = useCallback(() => {
    setActiveStep(0);
    setWorkingCopy({});
    setStepValidation({});
    setSourceSchema(null);
    setTargetSchema(null);
    setValidationResult(null);
    setHasCompletedOnce(false);
    onCancel();
  }, [onCancel]);

  const isStepComplete = useCallback((step: number) => {
    return stepValidation[step] === true;
  }, [stepValidation]);

  const canProceedToNext = isStepComplete(activeStep);
  const isLastStep = activeStep === STEPS.length - 1;

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <ResolverBasicInfoStep
            data={workingCopy}
            onUpdate={updateWorkingCopy}
            onValidationChange={(isValid) => handleStepValidation(0, isValid)}
          />
        );
      case 1:
        return (
          <SchemaSelectionStep
            data={workingCopy}
            onUpdate={updateWorkingCopy}
            onValidationChange={(isValid) => handleStepValidation(1, isValid)}
            onSourceSchemaChange={setSourceSchema}
            onTargetSchemaChange={setTargetSchema}
          />
        );
      case 2:
        return (
          <PropertyMappingStep
            data={workingCopy}
            onUpdate={updateWorkingCopy}
            onValidationChange={(isValid) => handleStepValidation(2, isValid)}
            sourceSchema={sourceSchema}
            targetSchema={targetSchema}
          />
        );
      case 3:
        return (
          <ValidationConfigStep
            data={workingCopy}
            onUpdate={updateWorkingCopy}
            onValidationChange={(isValid) => handleStepValidation(3, isValid)}
            sourceSchema={sourceSchema}
            targetSchema={targetSchema}
          />
        );
      case 4:
        return (
          <DuplicateResolutionStep
            data={workingCopy}
            onUpdate={updateWorkingCopy}
            onValidationChange={(isValid) => handleStepValidation(4, isValid)}
          />
        );
      case 5:
        return (
          <PreviewTestStep
            data={workingCopy}
            onUpdate={updateWorkingCopy}
            onValidationChange={(isValid) => handleStepValidation(5, isValid)}
            sourceSchema={sourceSchema}
            targetSchema={targetSchema}
            onValidationResult={setValidationResult}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { minHeight: '70vh', maxHeight: '90vh' }
      }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            {entity ? 'Edit Property Resolver' : 'Create Property Resolver'}
          </Typography>
          <IconButton
            onClick={handleCancel}
            size="small"
            sx={{ color: 'grey.500' }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pb: 1 }}>
        <Box sx={{ mb: 3 }}>
          <Stepper 
            activeStep={activeStep} 
            alternativeLabel
            sx={{ mb: 2 }}
          >
            {STEPS.map((label, index) => (
              <Step 
                key={label} 
                completed={isStepComplete(index)}
                sx={{
                  cursor: hasCompletedOnce || index <= activeStep ? 'pointer' : 'default',
                  '& .MuiStepLabel-root': {
                    cursor: hasCompletedOnce || index <= activeStep ? 'pointer' : 'default',
                  }
                }}
              >
                <StepLabel 
                  onClick={() => handleStepClick(index)}
                  sx={{
                    '&:hover': {
                      opacity: hasCompletedOnce || index <= activeStep ? 0.7 : 1,
                    }
                  }}
                >
                  {label}
                </StepLabel>
              </Step>
            ))}
          </Stepper>

          {validationResult && !validationResult.isValid && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Configuration validation failed. Please review the errors in the Preview & Test step.
            </Alert>
          )}
        </Box>

        <Box sx={{ minHeight: '400px' }}>
          {renderStepContent()}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={handleCancel}
          color="inherit"
        >
          Cancel
        </Button>
        
        <Box sx={{ flexGrow: 1 }} />
        
        {activeStep > 0 && (
          <Button
            onClick={handleBack}
            color="primary"
          >
            Back
          </Button>
        )}
        
        {!isLastStep ? (
          <Button
            onClick={handleNext}
            variant="contained"
            disabled={!canProceedToNext}
          >
            Next
          </Button>
        ) : (
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={!isStepComplete(activeStep) || isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};