import type { Theme } from '@mui/material/styles';
import { useCallback, useEffect, useId, useMemo, useState, type MouseEvent } from 'react';
import { STATUS, type CallBackProps, type Step } from 'react-joyride';
import { GuidedTourStateManager } from '~/managers/GuidedTourStateManager';

type UseGenericGuidedTourParams = {
  run: boolean;
  onFinish?: () => void;
  steps: Step[];
  tourType: string;
  callback?: (data: CallBackProps) => void;
  controlledStepIndex?: number;
  theme: Theme;
};

export const useGenericGuidedTour = ({
  run,
  onFinish,
  steps,
  tourType,
  callback,
  controlledStepIndex,
  theme,
}: UseGenericGuidedTourParams) => {
  const [internalStepIndex, setInternalStepIndex] = useState(0);
  const [showOnNextStartup, setShowOnNextStartup] = useState(true);
  const checkboxId = useId();

  const tourManager = GuidedTourStateManager.getInstance();
  const stepIndex = controlledStepIndex !== undefined ? controlledStepIndex : internalStepIndex;

  const handleCheckboxChange = useCallback(
    (checked: boolean) => {
      setShowOnNextStartup(checked);
      tourManager.setTourDisabled(tourType, !checked);
    },
    [tourManager, tourType]
  );

  useEffect(() => {
    if (run && controlledStepIndex === undefined) {
      setInternalStepIndex(0);
    }
  }, [run, controlledStepIndex]);

  useEffect(() => {
    if (!run) return;

    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        tourManager.markTourCompleted(tourType);
        if (!showOnNextStartup) {
          tourManager.setTourDisabled(tourType, true);
        }
        onFinish?.();
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [run, onFinish, tourManager, tourType, showOnNextStartup]);

  const handleJoyrideCallback = useCallback(
    (data: CallBackProps) => {
      const { status, type, index, action } = data;
      const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

      callback?.(data);

      if (status === 'error') {
        if (index !== undefined && index < steps.length - 1 && controlledStepIndex === undefined) {
          setInternalStepIndex(index + 1);
        }
      }

      if (action === 'close' || finishedStatuses.includes(status)) {
        tourManager.markTourCompleted(tourType);

        if (!showOnNextStartup) {
          tourManager.setTourDisabled(tourType, true);
        }

        if (controlledStepIndex === undefined) {
          setInternalStepIndex(0);
        }
        onFinish?.();
      } else if (
        type === 'step:after' &&
        action === 'next' &&
        index !== undefined &&
        controlledStepIndex === undefined
      ) {
        setInternalStepIndex(index + 1);
      } else if (
        type === 'step:after' &&
        action === 'prev' &&
        index !== undefined &&
        controlledStepIndex === undefined
      ) {
        setInternalStepIndex(index - 1);
      }
    },
    [
      onFinish,
      showOnNextStartup,
      tourManager,
      tourType,
      callback,
      controlledStepIndex,
      steps.length,
    ]
  );

  const joyrideStyles = useMemo(
    () => ({
      options: {
        primaryColor: theme.palette.primary.main,
        textColor: theme.palette.text.primary,
        backgroundColor: theme.palette.background.paper,
        arrowColor: theme.palette.background.paper,
        overlayColor: theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.3)',
        zIndex: 10001,
        spotlightPadding: 8,
      },
      buttonNext: {
        backgroundColor: theme.palette.primary.main,
        color: theme.palette.primary.contrastText,
        outline: 'none',
        padding: '8px 16px',
        borderRadius: theme.shape.borderRadius,
        fontSize: '14px',
        fontWeight: 500,
      },
      buttonBack: {
        color: theme.palette.text.primary,
        marginRight: '8px',
        outline: 'none',
        padding: '8px 16px',
        fontSize: '14px',
      },
      buttonSkip: {
        color: theme.palette.text.secondary,
        fontSize: '14px',
      },
      tooltip: {
        borderRadius: '20px',
        fontSize: '16px',
        boxShadow:
          theme.palette.mode === 'dark'
            ? '0 8px 24px rgba(0,0,0,0.6)'
            : '0 8px 24px rgba(0,0,0,0.25)',
      },
      tooltipContent: {
        padding: '20px',
      },
      spotlight: {
        backgroundColor: 'transparent',
        border: '3px solid #ffeb3b',
        borderRadius: '8px',
        boxShadow: '0 0 20px rgba(255, 235, 59, 0.8), 0 0 40px rgba(255, 235, 59, 0.4)',
        animation: 'pulse 2s ease-in-out infinite',
      },
      overlay: {
        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(0.5px)',
      },
    }),
    [theme]
  );

  const handleFooterPrimaryEnter = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.backgroundColor = theme.palette.primary.dark;
      e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
    },
    [theme.palette.primary.dark]
  );

  const handleFooterPrimaryLeave = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.backgroundColor = theme.palette.primary.main;
      e.currentTarget.style.boxShadow = 'none';
    },
    [theme.palette.primary.main]
  );

  return {
    checkboxId,
    stepIndex,
    showOnNextStartup,
    handleCheckboxChange,
    handleJoyrideCallback,
    joyrideStyles,
    handleFooterPrimaryEnter,
    handleFooterPrimaryLeave,
  };
};
