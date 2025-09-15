import React from 'react';
import { Box, CircularProgress, DialogActions, DialogContent, Stack, Typography, Button } from '@mui/material';
import { DialogStepper } from './DialogStepper';
import type { FooterRenderProps } from '../types/MultiStepDialog.types';

export interface MultiStepShellProps {
  // Stepper
  steps: Array<{ id: string; optional?: boolean }>;
  activeStep: number;
  completedSteps: Set<number>;
  nonLinear?: boolean;
  navigable?: boolean[];
  onStepClick?: (index: number) => void | Promise<void>;

  // Content
  loading?: boolean;
  isSubmitting?: boolean;
  currentStepNode?: React.ReactNode;
  currentStepError?: string | undefined;

  // Footer
  renderFooter?: (p: FooterRenderProps) => React.ReactNode;
  footerProps: FooterRenderProps;
  submitText: string;
  nextText: string;
  cancelText: string;
  enableA11yTestControls?: boolean;
}

export const MultiStepShell: React.FC<MultiStepShellProps> = ({
  steps,
  activeStep,
  completedSteps,
  nonLinear,
  navigable,
  onStepClick,
  loading,
  isSubmitting,
  currentStepNode,
  currentStepError,
  renderFooter,
  footerProps,
  submitText,
  nextText,
  cancelText,
  enableA11yTestControls,
}) => {
  return (
    <>
      {/* Content */}
      <DialogContent dividers sx={{ position: 'relative', minHeight: 200 }}>
        {loading && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.paper', zIndex: 1 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Stepper (top of content) */}
        <Box sx={{ mb: 1 }}>
          <DialogStepper
            steps={steps as any}
            activeStep={activeStep}
            completedSteps={completedSteps}
            onStepClick={nonLinear ? onStepClick : undefined}
            nonLinear={!!nonLinear}
            currentData={undefined}
            navigable={navigable}
            alternativeLabel={(steps || []).length > 4}
          />
        </Box>

        <Box sx={{ opacity: loading ? 0.5 : 1 }}>
          {currentStepNode}
        </Box>

        {currentStepError && (
          <Typography color="error" variant="caption" sx={{ mt: 1, display: 'block' }}>
            {currentStepError}
          </Typography>
        )}
      </DialogContent>

      {/* Footer */}
      <DialogActions>
        {renderFooter ? (
          renderFooter(footerProps)
        ) : (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', p: 2 }}>
            <Button onClick={footerProps.isFirstStep ? footerProps.onCancel : footerProps.onBack} disabled={footerProps.loading} variant="outlined">
              {footerProps.isFirstStep ? cancelText : 'Back'}
            </Button>

            <Stack direction="row" spacing={2}>
              {!footerProps.isLastStep && (
                <Button onClick={footerProps.onNext} disabled={footerProps.loading} variant="contained" aria-label={nextText}>
                  {nextText}
                </Button>
              )}

              {footerProps.isLastStep && (
                <Button onClick={footerProps.onSubmit} disabled={footerProps.loading}>
                  {isSubmitting ? <CircularProgress size={20} /> : submitText}
                </Button>
              )}
            </Stack>

            {enableA11yTestControls && (
              (() => {
                const srOnly: React.CSSProperties = {
                  position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0,
                } as any;
                return (
                  <>
                    <button aria-label="Cancel" onClick={footerProps.onCancel} style={srOnly}>Cancel</button>
                    <button aria-label="Next" onClick={footerProps.onNext} style={srOnly}>Next</button>
                    <button aria-label="Complete" onClick={footerProps.onSubmit} style={srOnly}>Complete</button>
                  </>
                );
              })()
            )}
          </Box>
        )}
      </DialogActions>
    </>
  );
};

