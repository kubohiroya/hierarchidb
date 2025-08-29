/**
 * @file MultiStepDialog.tsx
 * @description マルチステップダイアログコンポーネント
 */

import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import type { NodeId } from '@hierarchidb/common-type';
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
  Stack,
} from '@mui/material';
import { 
  Close, 
  NavigateBefore, 
  NavigateNext, 
  Check,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
} from '@mui/icons-material';
import { TransitionProps } from '@mui/material/transitions';
import { WizardProvider, useWizard } from './StepWizardContext';
import type { DialogStepDefinition } from '../services/DialogStepRegistry';

// ============================================================================
// 型定義
// ============================================================================

/**
 * アイコンボタングループの表示モード
 */
export type IconGroupDisplayMode = 'hidden' | 'always' | 'hover';

/**
 * アイコンボタングループの設定
 */
export interface IconGroupSettings {
  /** 通常サイズ画面での表示モード */
  normalMode: IconGroupDisplayMode;
  /** 全画面での表示モード */
  fullscreenMode: IconGroupDisplayMode;
}

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
  /** ノードID（PeerEntityベースの設定保存用） */
  nodeId?: NodeId;
  /** ノードタイプ（PeerEntityベースの設定保存用） */
  nodeType?: string;
  /** アイコンボタングループの初期設定 */
  iconGroupSettings?: IconGroupSettings;
  /** URLパラメータからの初期ステップ */
  initialStepFromUrl?: number;
  /** URLパラメータからの初期全画面モード */
  initialFullscreenFromUrl?: boolean;
  /** URLパラメータからの初期地図パラメータ */
  initialMapParamsFromUrl?: { zoom: number; lng: number; lat: number };
  /** ステップ変更時のコールバック */
  onStepChange?: (step: number) => void;
  /** 全画面モード変更時のコールバック */
  onFullscreenChange?: (isFullscreen: boolean) => void;
  /** 地図パラメータ変更時のコールバック */
  onMapParamsChange?: (params: { zoom: number; lng: number; lat: number } | undefined) => void;
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

import { useDialogMode } from '../hooks/useDialogMode';

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
  nodeId,
  nodeType,
  iconGroupSettings: initialIconGroupSettings,
  initialStepFromUrl,
  initialFullscreenFromUrl,
  initialMapParamsFromUrl,
  onStepChange,
  onFullscreenChange,
  onMapParamsChange,
}: MultiStepDialogProps) {
  if (steps.length === 0) {
    return null;
  }

  // PeerEntityベースのダイアログモード管理
  const { 
    dialogMode: savedDialogMode, 
    setDialogMode: saveDialogMode,
    resumeStep: savedResumeStep,
    setResumeStep,
    clearResumeStep,
    mapParams: savedMapParams,
    setMapParams
  } = useDialogMode(
    nodeId,
    nodeType,
    'normal'
  );

  const defaultIconGroupSettings: IconGroupSettings = initialIconGroupSettings ?? {
    normalMode: 'always',
    fullscreenMode: 'hover',
  };

  // URL パラメータの優先順位: URL > PeerEntity > デフォルト
  const initialFullscreen = initialFullscreenFromUrl !== undefined 
    ? initialFullscreenFromUrl 
    : savedDialogMode === 'full';

  // 初期ステップの優先順位: URL > PeerEntity > デフォルト
  const initialStep = initialStepFromUrl || savedResumeStep || 1;

  // 初期地図パラメータの優先順位: URL > PeerEntity
  const initialMapParams = initialMapParamsFromUrl || savedMapParams;

  // 状態管理
  const [isFullscreen, setIsFullscreen] = useState(initialFullscreen);
  const [iconGroupSettings] = useState<IconGroupSettings>(
    initialIconGroupSettings ?? defaultIconGroupSettings
  );
  const [isHovering, setIsHovering] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(!initialFullscreen);
  const [isFooterVisible, setIsFooterVisible] = useState(!initialFullscreen);
  const [currentStep, setCurrentStep] = useState(initialStep);
  const dialogRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout>();
  const headerTimeoutRef = useRef<NodeJS.Timeout>();
  const footerTimeoutRef = useRef<NodeJS.Timeout>();

  // 全画面切り替え
  const toggleFullscreen = useCallback(() => {
    const newFullscreen = !isFullscreen;
    setIsFullscreen(newFullscreen);
    
    // フルスクリーン切り替え時にヘッダー・フッターの表示状態を調整
    if (newFullscreen) {
      setIsHeaderVisible(false);
      setIsFooterVisible(false);
    } else {
      setIsHeaderVisible(true);
      setIsFooterVisible(true);
    }
    
    // PeerEntityに保存
    if (nodeId && nodeType) {
      saveDialogMode(newFullscreen ? 'full' : 'normal');
    }
    
    // コールバックを呼び出し
    if (onFullscreenChange) {
      onFullscreenChange(newFullscreen);
    }
  }, [isFullscreen, nodeId, nodeType, saveDialogMode, onFullscreenChange]);

  // アイコングループの表示判定
  const shouldShowIconGroup = useMemo(() => {
    const currentMode = isFullscreen ? iconGroupSettings.fullscreenMode : iconGroupSettings.normalMode;
    
    switch (currentMode) {
      case 'hidden':
        return false;
      case 'always':
        return true;
      case 'hover':
        return isHovering;
      default:
        return true;
    }
  }, [isFullscreen, iconGroupSettings, isHovering]);

  // ホバー処理（全画面時のみ）
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isFullscreen) {
      return;
    }

    const headerThreshold = 60; // ヘッダー表示の閾値
    const footerThreshold = 60; // フッター表示の閾値
    const windowHeight = window.innerHeight;

    // ヘッダー領域のホバー判定
    if (e.clientY < headerThreshold) {
      if (!isHeaderVisible) {
        setIsHeaderVisible(true);
        setIsHovering(true); // アイコングループも表示
      }
      
      // タイムアウトをリセット
      if (headerTimeoutRef.current) {
        clearTimeout(headerTimeoutRef.current);
      }
      
      // 3秒後に自動的に非表示
      headerTimeoutRef.current = setTimeout(() => {
        setIsHeaderVisible(false);
        setIsHovering(false);
      }, 3000);
    }

    // フッター領域のホバー判定
    if (e.clientY > windowHeight - footerThreshold) {
      if (!isFooterVisible) {
        setIsFooterVisible(true);
      }
      
      // タイムアウトをリセット
      if (footerTimeoutRef.current) {
        clearTimeout(footerTimeoutRef.current);
      }
      
      // 3秒後に自動的に非表示
      footerTimeoutRef.current = setTimeout(() => {
        setIsFooterVisible(false);
      }, 3000);
    }
  }, [isFullscreen, isHeaderVisible, isFooterVisible]);

  const handleMouseLeave = useCallback(() => {
    // 各タイムアウトをクリア
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    if (headerTimeoutRef.current) {
      clearTimeout(headerTimeoutRef.current);
    }
    if (footerTimeoutRef.current) {
      clearTimeout(footerTimeoutRef.current);
    }
    
    // フルスクリーン時は即座に隠す
    if (isFullscreen) {
      setIsHovering(false);
      setIsHeaderVisible(false);
      setIsFooterVisible(false);
    }
  }, [isFullscreen]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      if (headerTimeoutRef.current) {
        clearTimeout(headerTimeoutRef.current);
      }
      if (footerTimeoutRef.current) {
        clearTimeout(footerTimeoutRef.current);
      }
    };
  }, []);

  // ステップ変更時にresumeStepを保存
  useEffect(() => {
    if (nodeId && nodeType && currentStep !== savedResumeStep) {
      setResumeStep(currentStep);
    }
  }, [currentStep, nodeId, nodeType, savedResumeStep, setResumeStep]);

  // ダイアログが閉じられる時にresumeStepを保存
  const handleDialogClose = useCallback(() => {
    // 現在のステップをresumeStepとして保存
    if (nodeId && nodeType) {
      setResumeStep(currentStep);
    }
    onClose();
  }, [currentStep, nodeId, nodeType, setResumeStep, onClose]);

  // ダイアログが完了した時にresumeStepをクリア
  const handleDialogComplete = useCallback(async (data: Record<string, unknown>) => {
    // 完了時はresumeStep・mapParamsをクリア
    if (nodeId && nodeType) {
      await clearResumeStep();
      await setMapParams(undefined);
    }
    await onComplete(data);
  }, [nodeId, nodeType, clearResumeStep, setMapParams, onComplete]);

  // 地図パラメータ変更の処理
  const handleMapParamsChange = useCallback((params: { zoom: number; lng: number; lat: number } | undefined) => {
    // PeerEntityに保存
    if (nodeId && nodeType) {
      setMapParams(params);
    }
    // コールバックを呼び出し
    if (onMapParamsChange) {
      onMapParamsChange(params);
    }
  }, [nodeId, nodeType, setMapParams, onMapParamsChange]);

  const TransitionComponent = transition === 'slide' ? SlideTransition : Fade;
  
  return (
    <Dialog
      ref={dialogRef}
      open={open}
      onClose={handleDialogClose}
      maxWidth={isFullscreen ? false : maxWidth}
      fullWidth={!isFullscreen && fullWidth}
      fullScreen={isFullscreen}
      TransitionComponent={TransitionComponent}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <WizardProvider 
        stepDefinitions={steps} 
        initialData={{
          ...initialData,
          mapInitialParams: initialMapParams,
          onMapParamsChange: handleMapParamsChange
        }}
        initialStep={currentStep}
        onStepChange={onStepChange}
      >
        <DialogTitle
          sx={{
            position: isFullscreen ? 'fixed' : 'relative',
            top: isFullscreen ? (isHeaderVisible ? 0 : -80) : 'auto',
            left: 0,
            right: 0,
            zIndex: isFullscreen ? 1300 : 'auto',
            transition: 'top 0.3s ease-in-out',
            backgroundColor: isFullscreen ? 'background.paper' : 'transparent',
            boxShadow: isFullscreen && isHeaderVisible ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">{title}</Typography>
            
            {/* アイコンボタングループ */}
            <Fade in={shouldShowIconGroup}>
              <Stack 
                direction="row" 
                spacing={1}
                sx={{
                  position: isFullscreen && iconGroupSettings.fullscreenMode === 'hover' ? 'absolute' : 'relative',
                  right: isFullscreen && iconGroupSettings.fullscreenMode === 'hover' ? 16 : 0,
                  top: isFullscreen && iconGroupSettings.fullscreenMode === 'hover' ? 16 : 0,
                  backgroundColor: isFullscreen && iconGroupSettings.fullscreenMode === 'hover' 
                    ? 'rgba(255, 255, 255, 0.95)' 
                    : 'transparent',
                  borderRadius: 1,
                  padding: isFullscreen && iconGroupSettings.fullscreenMode === 'hover' ? 1 : 0,
                  boxShadow: isFullscreen && iconGroupSettings.fullscreenMode === 'hover' 
                    ? '0 2px 8px rgba(0,0,0,0.15)' 
                    : 'none',
                }}
              >
                <IconButton
                  onClick={toggleFullscreen}
                  color="inherit"
                  aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                  size="small"
                >
                  {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
                </IconButton>
                <IconButton
                  aria-label="close"
                  onClick={onClose}
                  color="inherit"
                  size="small"
                >
                  <Close />
                </IconButton>
              </Stack>
            </Fade>
          </Box>
        </DialogTitle>
        
        <DialogContent
          sx={{
            // フルスクリーン時はヘッダー・フッターのスペースを考慮
            paddingTop: isFullscreen ? '80px' : undefined,
            paddingBottom: isFullscreen ? '80px' : undefined,
            height: isFullscreen ? '100vh' : 'auto',
            overflow: 'auto',
          }}
        >
          {/* ステッパーもヘッダーと一緒に隠す */}
          <Box
            sx={{
              opacity: isFullscreen ? (isHeaderVisible ? 1 : 0) : 1,
              transition: 'opacity 0.3s ease-in-out',
              pointerEvents: isFullscreen && !isHeaderVisible ? 'none' : 'auto',
            }}
          >
            <StepNavigation allowStepNavigation={allowStepNavigation} />
          </Box>
          <StepContentRenderer />
        </DialogContent>
        
        <DialogActions 
          sx={{ 
            p: 2,
            position: isFullscreen ? 'fixed' : 'relative',
            bottom: isFullscreen ? (isFooterVisible ? 0 : -80) : 'auto',
            left: 0,
            right: 0,
            zIndex: isFullscreen ? 1300 : 'auto',
            transition: 'bottom 0.3s ease-in-out',
            backgroundColor: isFullscreen ? 'background.paper' : 'transparent',
            boxShadow: isFullscreen && isFooterVisible ? '0 -2px 8px rgba(0,0,0,0.15)' : 'none',
            borderTop: isFullscreen && isFooterVisible ? '1px solid' : 'none',
            borderColor: 'divider',
          }}
        >
          <DialogActionsContent onComplete={handleDialogComplete} onClose={handleDialogClose} />
        </DialogActions>
      </WizardProvider>
    </Dialog>
  );
}

export default MultiStepDialog;