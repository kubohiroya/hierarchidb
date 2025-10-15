import type React from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import { DialogStepDefinition } from '@hierarchidb/plugin-api';

export interface BaseDialogProps {
  title: string;
  icon?: React.ReactNode;
  steps: ReadonlyArray<DialogStepDefinition>;
  activeStepIndex: number;
  open: boolean;
  errors?: ReadonlyArray<string>;
  onCancel: () => void;
  onBack: () => void;
  onNext: () => void;
  onComplete: () => void;
  canBack: boolean;
  canNext: boolean;
  canComplete: boolean;
  renderStepContent: (step: DialogStepDefinition | undefined) => React.ReactNode;
}

export const BaseDialog: React.FC<BaseDialogProps> = ({
  title,
  icon,
  steps,
  activeStepIndex,
  open,
  errors = [],
  onCancel,
  onBack,
  onNext,
  onComplete,
  canBack,
  canNext,
  canComplete,
  renderStepContent,
}) => {
  if (!open) return null;

  const currentStep = steps[activeStepIndex];

  return (
    <Box
      role="dialog"
      aria-modal="true"
      sx={(theme) => ({
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: theme.palette.divider,
        borderRadius: 2,
        padding: 3,
        maxWidth: 520,
        margin: '24px auto',
        backgroundColor: theme.palette.background.paper,
        boxShadow: theme.shadows[8],
      })}
    >
      <Stack direction="row" spacing={2} alignItems="center" mb={2}>
        {icon}
        <Typography variant="h5">{title}</Typography>
      </Stack>

      <Box component="ol" sx={{ listStyle: 'none', padding: 0, display: 'flex', gap: 2, mb: 3 }}>
        {steps.map((step, idx) => (
          <Box
            key={step.stepNumber}
            component="li"
            sx={(theme) => ({
              padding: '8px 12px',
              borderRadius: 1,
              backgroundColor: idx === activeStepIndex
                ? theme.palette.primary.main
                : theme.palette.action.selected,
              color: idx === activeStepIndex
                ? theme.palette.primary.contrastText
                : theme.palette.text.primary,
              fontWeight: 600,
            })}
          >
            {step.title ?? `Step ${step.stepNumber}`}
          </Box>
        ))}
      </Box>

      {errors.length > 0 && (
        <Box
          mb={2}
          sx={(theme) => ({
            color: theme.palette.error.main,
          })}
        >
          {errors.map((err, i) => (
            <Typography key={i} variant="body2">{err}</Typography>
          ))}
        </Box>
      )}

      <Box mb={3}>{renderStepContent(currentStep)}</Box>

      <Stack direction="row" spacing={2} justifyContent="flex-end">
        <Button variant="text" onClick={onCancel}>Cancel</Button>
        <Button variant="outlined" onClick={onBack} disabled={!canBack}>Back</Button>
        {activeStepIndex < steps.length - 1 ? (
          <Button variant="contained" onClick={onNext} disabled={!canNext}>
            Next
          </Button>
        ) : (
          <Button variant="contained" onClick={onComplete} disabled={!canComplete}>
            Complete
          </Button>
        )}
      </Stack>
    </Box>
  );
};
