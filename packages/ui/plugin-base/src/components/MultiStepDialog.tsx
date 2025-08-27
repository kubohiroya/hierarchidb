/**
 * @file MultiStepDialog.tsx
 * @description マルチステップダイアログコンポーネント
 */

import React, { useMemo, useState, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stepper,
  Step,
  StepLabel,
  StepButton,
  Box,
  Typography,
  CircularProgress,
  Alert,
  IconButton,
  Fade,
  Slide,
} from '@mui/material';
import { Close, NavigateBefore, NavigateNext, Check } from '@mui/icons-material';
import { TransitionProps } from '@mui/material/transitions';
import { WizardProvider, useWizard } from './StepWizardContext';
import type { DialogStepDefinition } from '../services/DialogStepRegistry';

// ============================================================================
// 型定義
// ============================================================================

/**
 * マルチステップダイアログのプロパティ
 */
export interface MultiStepDialogProps {
  /** ダイアログが開いているか */
  open: boolean;
  /** ダイアログを閉じる */
  onClose: () => void;
  /** 完了時の処理 */
  onComplete: (data: Record<string, unknown>) => Promise<void>;
  /** ステップ定義 */
  steps: DialogStepDefinition[];
  /** ダイアログタイトル */
  title?: string;
  /** 初期データ */
  initialData?: Record<string, unknown>;
  /** 最大幅 */
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** 全幅表示 */
  fullWidth?: boolean;
  /** ステップラベルをクリック可能にするか */
  allowStepNavigation?: boolean;
  /** トランジション */
  transition?: 'fade' | 'slide';
}

// ============================================================================
// トランジション
// ============================================================================

const SlideTransition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement<any, any>;
  },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

// ============================================================================
// 内部コンポーネント
// ============================================================================

/**
 * ステップコンテンツレンダラー
 */
function StepContentRenderer() {
  const { state, actions, stepDefinitions } = useWizard();
  const currentStepDef = stepDefinitions.find(s => s.stepNumber === state.currentStep);
  
  if (!currentStepDef) {
    return <Typography>Step not found</Typography>;
  }
  
  const StepComponent = currentStepDef.component;
  const stepState = state.steps.get(state.currentStep);
  
  const handleChange = useCallback((data: any) => {
    actions.updateStepData(state.currentStep, data);
  }, [actions, state.currentStep]);
  
  const handleNext = useCallback((data: any) => {
    actions.updateStepData(state.currentStep, data);
    actions.goToNext();
  }, [actions, state.currentStep]);
  
  const handlePrevious = useCallback(() => {
    actions.goPrevious();
  }, [actions]);
  
  return (
    <Box sx={{ minHeight: 300, position: 'relative' }}>
      {state.isLoading && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'rgba(255, 255, 255, 0.7)',
            zIndex: 1,
          }}
        >
          <CircularProgress />
        </Box>
      )}
      
      <Fade in key={state.currentStep}>
        <Box>
          <StepComponent
            data={stepState?.data || {}}
            onChange={handleChange}
            onNext={handleNext}
            onPrevious={handlePrevious}
            errors={stepState?.errors || []}
            isLoading={state.isLoading}
          />
        </Box>
      </Fade>
    </Box>
  );
}

/**
 * ステップナビゲーション
 */
function StepNavigation({ allowStepNavigation = false }: { allowStepNavigation?: boolean }) {
  const { state, actions, helpers, stepDefinitions } = useWizard();
  
  const handleStepClick = (stepNumber: number) => {
    if (allowStepNavigation && helpers.canGoToStep(stepNumber)) {
      actions.goToStep(stepNumber);
    }
  };
  
  return (
    <Stepper activeStep={state.currentStep - 1} sx={{ pt: 3, pb: 5 }}>
      {stepDefinitions.map((step) => {
        const stepState = state.steps.get(step.stepNumber);
        const canNavigate = allowStepNavigation && helpers.canGoToStep(step.stepNumber);
        
        return (
          <Step key={step.stepNumber} completed={stepState?.isCompleted}>
            {allowStepNavigation ? (
              <StepButton
                onClick={() => handleStepClick(step.stepNumber)}
                disabled={!canNavigate}
              >
                <StepLabel
                  error={stepState?.errors && stepState.errors.length > 0}
                  optional={
                    step.isOptional ? (
                      <Typography variant="caption">Optional</Typography>
                    ) : undefined
                  }
                >
                  {step.title}
                </StepLabel>
              </StepButton>
            ) : (
              <StepLabel
                error={stepState?.errors && stepState.errors.length > 0}
                optional={
                  step.isOptional ? (
                    <Typography variant="caption">Optional</Typography>
                  ) : undefined
                }
              >
                {step.title}
              </StepLabel>
            )}
          </Step>
        );
      })}
    </Stepper>
  );
}

/**
 * ダイアログアクション
 */
function DialogActionsContent({ onComplete, onClose }: { onComplete: (data: Record<string, unknown>) => Promise<void>; onClose: () => void }) {
  const { state, actions, helpers, stepDefinitions } = useWizard();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  
  const isLastStep = useMemo(() => {
    const sortedSteps = [...stepDefinitions].sort((a, b) => a.stepNumber - b.stepNumber);
    return state.currentStep === sortedSteps[sortedSteps.length - 1]?.stepNumber;
  }, [state.currentStep, stepDefinitions]);
  
  const handleNext = async () => {
    const currentStepDef = stepDefinitions.find(s => s.stepNumber === state.currentStep);
    const stepState = state.steps.get(state.currentStep);
    
    // バリデーション実行
    if (currentStepDef?.validation) {
      const result = await currentStepDef.validation.validate(stepState?.data || {});
      actions.validateStep(state.currentStep, result);
      
      if (!result.isValid) {
        return;
      }
    }
    
    actions.completeStep(state.currentStep);
    
    if (isLastStep) {
      // 最後のステップの場合は完了処理
      setIsSubmitting(true);
      setSubmitError(null);
      
      try {
        await onComplete(helpers.getAllData());
        actions.complete();
        onClose();
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : 'An error occurred');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      actions.goToNext();
    }
  };
  
  return (
    <>
      {submitError && (
        <Alert severity="error" sx={{ mr: 2 }}>
          {submitError}
        </Alert>
      )}
      
      <Button
        onClick={() => actions.goPrevious()}
        disabled={!helpers.canGoPrevious() || isSubmitting}
        startIcon={<NavigateBefore />}
      >
        Previous
      </Button>
      
      <Box sx={{ flex: '1 0 auto' }} />
      
      <Button
        onClick={onClose}
        disabled={isSubmitting}
      >
        Cancel
      </Button>
      
      <Button
        onClick={handleNext}
        variant="contained"
        disabled={isSubmitting}
        startIcon={isSubmitting ? <CircularProgress size={20} /> : isLastStep ? <Check /> : <NavigateNext />}
      >
        {isLastStep ? 'Complete' : 'Next'}
      </Button>
    </>
  );
}

// ============================================================================
// メインコンポーネント
// ============================================================================

/**
 * マルチステップダイアログコンポーネント
 */
export function MultiStepDialog({
  open,
  onClose,
  onComplete,
  steps,
  title = 'Multi-Step Dialog',
  initialData = {},
  maxWidth = 'md',
  fullWidth = true,
  allowStepNavigation = false,
  transition = 'fade',
}: MultiStepDialogProps) {
  if (steps.length === 0) {
    return null;
  }
  
  const TransitionComponent = transition === 'slide' ? SlideTransition : Fade;
  
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
      TransitionComponent={TransitionComponent}
    >
      <WizardProvider stepDefinitions={steps} initialData={initialData}>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">{title}</Typography>
            <IconButton
              aria-label="close"
              onClick={onClose}
              sx={{ color: (theme) => theme.palette.grey[500] }}
            >
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <StepNavigation allowStepNavigation={allowStepNavigation} />
          <StepContentRenderer />
        </DialogContent>
        
        <DialogActions sx={{ p: 2 }}>
          <DialogActionsContent onComplete={onComplete} onClose={onClose} />
        </DialogActions>
      </WizardProvider>
    </Dialog>
  );
}

export default MultiStepDialog;