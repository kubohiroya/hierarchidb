/**
 * Route Dialog Component
 * ルート作成・編集ダイアログ
 */

import React, { useState } from 'react';
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
  Divider,
} from '@mui/material';
import { Close, ArrowBack, ArrowForward, Save } from '@mui/icons-material';
import type { NodeId } from '@hierarchidb/common-type';
import type { RouteWorkingCopy } from '../types';
import { useTranslation } from '../i18n';
import { RouteBasicInfoStep } from './RouteBasicInfoStep';
import { RouteSelectionStep } from './RouteSelectionStep';
import { RouteProcessingStep } from './RouteProcessingStep';

export interface RouteDialogProps {
  open: boolean;
  onClose: () => void;
  nodeId: NodeId;
  workingCopy: RouteWorkingCopy;
  onSave: (workingCopy: RouteWorkingCopy) => void;
  onCancel: () => void;
}

export const RouteDialog: React.FC<RouteDialogProps> = ({
  open,
  onClose,
  nodeId: _nodeId,
  workingCopy,
  onSave,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [activeStep, setActiveStep] = useState(0);
  const [stepValidation, setStepValidation] = useState<boolean[]>([false, false, false]);

  const steps = [
    t('dialog.steps.basicInfo', 'Basic Information'),
    t('dialog.steps.routeSelection', 'Route Selection'),
    t('dialog.steps.processing', 'Processing'),
  ];

  const handleStepValidationChange = (stepIndex: number, isValid: boolean) => {
    setStepValidation(prev => {
      const newValidation = [...prev];
      newValidation[stepIndex] = isValid;
      return newValidation;
    });
  };

  const handleNext = () => {
    if (activeStep < steps.length - 1) {
      setActiveStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep(prev => prev - 1);
    }
  };

  const handleSave = () => {
    onSave(workingCopy);
  };

  const handleCancel = () => {
    onCancel();
  };

  const isStepValid = (stepIndex: number) => {
    return stepValidation[stepIndex];
  };

  const canProceed = () => {
    return isStepValid(activeStep);
  };

  const isLastStep = activeStep === steps.length - 1;

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { height: '80vh', display: 'flex', flexDirection: 'column' }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">
            {t('dialog.title', 'Route Configuration')}
          </Typography>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 0 }}>
        {/* Stepper */}
        <Box sx={{ px: 3, pt: 2, pb: 1 }}>
          <Stepper activeStep={activeStep} alternativeLabel>
            {steps.map((label, index) => (
              <Step key={label} completed={index < activeStep || (isStepValid(index) ? true : false)}>
                <StepLabel error={index === activeStep && !isStepValid(index)}>
                  {label}
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>

        <Divider />

        {/* Step Content */}
        <Box sx={{ flex: 1, p: 3, overflow: 'auto' }}>
          {activeStep === 0 && (
            <RouteBasicInfoStep
              workingCopy={workingCopy}
              onUpdate={(updates) => onSave({ ...workingCopy, ...updates })}
              onValidationChange={(isValid: boolean) => handleStepValidationChange(0, isValid)}
            />
          )}
          
          {activeStep === 1 && (
            <RouteSelectionStep
              workingCopy={workingCopy}
              onUpdate={(updates) => onSave({ ...workingCopy, ...updates })}
              onValidationChange={(isValid: boolean) => handleStepValidationChange(1, isValid)}
            />
          )}
          
          {activeStep === 2 && (
            <RouteProcessingStep
              workingCopy={workingCopy}
              onUpdate={(updates) => onSave({ ...workingCopy, ...updates })}
              onValidationChange={(isValid: boolean) => handleStepValidationChange(2, isValid)}
            />
          )}
        </Box>
      </DialogContent>

      <Divider />

      <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
        <Box>
          <Button
            onClick={handleBack}
            disabled={activeStep === 0}
            startIcon={<ArrowBack />}
          >
            {t('dialog.back', 'Back')}
          </Button>
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={handleCancel}>
            {t('dialog.cancel', 'Cancel')}
          </Button>
          
          {!isLastStep ? (
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={!canProceed()}
              endIcon={<ArrowForward />}
            >
              {t('dialog.next', 'Next')}
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={!canProceed()}
              startIcon={<Save />}
            >
              {t('dialog.save', 'Save Route')}
            </Button>
          )}
        </Box>
      </DialogActions>
    </Dialog>
  );
};