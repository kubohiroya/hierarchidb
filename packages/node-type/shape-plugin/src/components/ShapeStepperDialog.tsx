import React, { useCallback, useMemo, useState } from 'react';
import { Box, Button, Stack } from '@mui/material';
import { Category as CategoryIcon, PlayArrow as PlayArrowIcon } from '@mui/icons-material';
import { StepperDialog, useWorkingCopy } from '@hierarchidb/runtime-base-dialog';
import type { NodeId } from '@hierarchidb/common-type';
import type { ProcessingConfig, ShapeDialogProps, ShapeWorkingCopy } from '~/shared';
import { DEFAULT_PROCESSING_CONFIG } from '~/shared';
import { generateUrlMetadata } from '~/mock/data';

// Import step components
import { Step1BasicInfo } from './steps/Step1BasicInfo';
import { Step2DataSource } from './steps/Step2DataSource';
import { Step3License } from './steps/Step3License';
import { Step4Processing } from './steps/Step4Processing';
import { Step5CountrySelection } from './steps/Step5CountrySelection';
import { BatchProcessingMonitorDialog } from './BatchProcessingMonitorDialog';

const getInitialShapeData = (): ShapeWorkingCopy => ({
  id: '' as NodeId,
  nodeId: '' as NodeId,
  name: '',
  description: '',
  dataSourceName: 'naturalearth',
  licenseAgreement: false,
  processingConfig: DEFAULT_PROCESSING_CONFIG,
  checkboxState: [],
  selectedCountries: [],
  adminLevels: [],
  urlMetadata: [],
  isDraft: true,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  version: 1,
});

export const ShapeStepperDialog: React.FC<ShapeDialogProps> = ({
                                                                 mode = 'create',
                                                                 nodeId,
                                                                 parentId,
                                                                 open = true,
                                                                 onClose,
                                                               }) => {
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);

  // Working Copy management using ui-base-dialog hook
  const {
    workingCopy,
    updateWorkingCopy,
    commitChanges,
    discardWorkingCopy,
    saveAsDraft,
    isDirty,
    isProcessing,
  } = useWorkingCopy<ShapeWorkingCopy>({
    mode,
    nodeId: nodeId as NodeId,
    parentId: parentId as NodeId,
    initialData: getInitialShapeData(),
    onCommit: async (data) => {
      // In production, this would save to the actual database
      // Simulate commit; real commit handled by worker side in production
      void nodeId;
      },
  });

  // Validation functions
  const validateProcessingConfig = (cfg: ProcessingConfig): boolean => {
    const errors: string[] = [];
    if (cfg.workerPoolSize && (cfg.workerPoolSize < 1 || cfg.workerPoolSize > 8)) {
      errors.push('Worker pool size must be between 1 and 8');
    }
    if (cfg.simplificationLevels) {
      for (const level of cfg.simplificationLevels) {
        if (level < 0 || level > 1) errors.push('Simplification levels must be between 0 and 1');
      }
    }
    if (cfg.tileZoomRange) {
      const [minZoom, maxZoom] = cfg.tileZoomRange;
      if (minZoom < 0 || maxZoom > 18 || minZoom >= maxZoom) errors.push('Invalid tile zoom range');
    }
    return errors.length === 0;
  };

  const hasSelectedCountries = (wc: ShapeWorkingCopy): boolean => {
    if (Array.isArray(wc.checkboxState)) {
      return wc.checkboxState.some((row) => row.some((cell) => cell === true));
    }
    return false;
  };

  // Check if batch processing can start
  const canStartBatch = useMemo(() => {
    return (
      workingCopy.name &&
      workingCopy.name.length > 0 &&
      !!workingCopy.dataSourceName &&
      workingCopy.licenseAgreement === true &&
      validateProcessingConfig(workingCopy.processingConfig) &&
      hasSelectedCountries(workingCopy)
    );
  }, [workingCopy, workingCopy.dataSourceName, workingCopy.licenseAgreement, workingCopy.processingConfig]);

  // Start batch processing
  const handleStartBatch = useCallback(() => {
    // Generate URL metadata based on selections
    const urlMetadata = generateUrlMetadata(
      workingCopy.selectedCountries || [],
      workingCopy.adminLevels || [],
      workingCopy.dataSourceName,
    );

    // Update working copy with URL metadata
    updateWorkingCopy({ urlMetadata });

    // Open batch base-dialog
    setBatchDialogOpen(true);
  }, [updateWorkingCopy, workingCopy.selectedCountries, workingCopy.adminLevels, workingCopy.dataSourceName]);

  // Handle batch base-dialog close
  const handleBatchDialogClose = useCallback(() => {
    setBatchDialogOpen(false);
    // Return to main base-dialog (don't close it)
  }, []);

  // Handle batch completion
  const handleBatchCompleted = useCallback(() => {
    // Close batch base-dialog
    setBatchDialogOpen(false);
    // Commit changes and close main base-dialog
    commitChanges();
    onClose();
  }, [commitChanges, onClose]);

  // Define stepper steps
  const steps = [
    {
      label: 'Basic Information',
      content: <Step1BasicInfo workingCopy={workingCopy} onUpdate={updateWorkingCopy} />,
      validate: () => !!workingCopy.name && workingCopy.name.length > 0,
    },
    {
      label: 'Data Source',
      content: <Step2DataSource workingCopy={workingCopy} onUpdate={updateWorkingCopy} />,
      validate: () => !!workingCopy.dataSourceName,
    },
    {
      label: 'License Agreement',
      content: <Step3License workingCopy={workingCopy} onUpdate={updateWorkingCopy} />,
      validate: () => workingCopy.licenseAgreement === true,
    },
    {
      label: 'Processing Configuration',
      content: <Step4Processing workingCopy={workingCopy} onUpdate={updateWorkingCopy} />,
      validate: () => validateProcessingConfig(workingCopy.processingConfig),
    },
    {
      label: 'Country Selection',
      content: <Step5CountrySelection workingCopy={workingCopy} onUpdate={updateWorkingCopy} />,
      validate: () => hasSelectedCountries(workingCopy),
    },
  ];

  return (
    <>
      <StepperDialog
        mode={mode}
        open={open && !batchDialogOpen}
        nodeId={nodeId}
        parentId={parentId}
        title="Shape Data Configuration"
        icon={<CategoryIcon />}
        steps={steps}
        hasUnsavedChanges={isDirty}
        supportsDraft={true}
        onSubmit={commitChanges}
        onSaveDraft={saveAsDraft}
        onCancel={() => {
          discardWorkingCopy();
          onClose();
        }}
        maxWidth="lg"
        nonLinear={mode === 'edit'}
        // Custom footer with Start Batch button
        customFooterContent={({
                                currentStep,
                                isFirstStep,
                                isLastStep,
                                canGoNext,
                                onBack,
                                onNext,
                              }) => (
          <CustomStepperFooter
            currentStep={currentStep}
            isFirstStep={isFirstStep}
            isLastStep={isLastStep}
            canGoNext={canGoNext}
            canStartBatch={canStartBatch}
            showStartBatch={currentStep >= 3} // Show on Step 4-5
            onBack={onBack}
            onNext={onNext}
            onCancel={() => {
              discardWorkingCopy();
              onClose();
            }}
            onStartBatch={handleStartBatch}
          />
        )}
      />

      {/* Batch Processing Monitor Dialog */}
      {batchDialogOpen && nodeId && (
        <BatchProcessingMonitorDialog
          open={batchDialogOpen}
          onClose={handleBatchDialogClose}
          nodeId={nodeId}
          config={workingCopy.processingConfig}
          urlMetadata={workingCopy.urlMetadata || []}
          onBatchCompleted={handleBatchCompleted}
        />
      )}
    </>
  );
};

// Custom footer component with Start Batch button
interface CustomStepperFooterProps {
  currentStep: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  canGoNext: boolean;
  canStartBatch: boolean;
  showStartBatch: boolean;
  onBack: () => void;
  onNext: () => void;
  onCancel: () => void;
  onStartBatch: () => void;
}

const CustomStepperFooter: React.FC<CustomStepperFooterProps> = ({
                                                                   currentStep,
                                                                   isFirstStep,
                                                                   isLastStep,
                                                                   canGoNext,
                                                                   canStartBatch,
                                                                   showStartBatch,
                                                                   onBack,
                                                                   onNext,
                                                                   onCancel,
                                                                   onStartBatch,
                                                                 }) => {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2 }}>
      {/* Left side button */}
      <Button onClick={isFirstStep ? onCancel : onBack} variant="outlined" size="large">
        {isFirstStep ? 'Cancel' : 'Back'}
      </Button>

      {/* Right side buttons */}
      <Stack direction="row" spacing={2}>
        {!isLastStep && (
          <Button onClick={onNext} variant="contained" size="large" disabled={!canGoNext}>
            Next
          </Button>
        )}

        {showStartBatch && (
          <Button
            onClick={onStartBatch}
            variant="contained"
            size="large"
            disabled={!canStartBatch}
            color="success"
            startIcon={<PlayArrowIcon />}
            sx={{ minWidth: 140 }}
          >
            Start Batch
          </Button>
        )}

        {isLastStep && !showStartBatch && (
          <Button onClick={onNext} variant="contained" size="large" disabled={!canGoNext}>
            Save
          </Button>
        )}
      </Stack>
    </Box>
  );
};
