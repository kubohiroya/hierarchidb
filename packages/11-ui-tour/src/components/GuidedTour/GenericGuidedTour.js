import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { useCallback, useEffect, useState } from 'react';
import Joyride, { STATUS } from 'react-joyride';
import { useTheme } from '@mui/material/styles';
import { Box, Checkbox, FormControlLabel, GlobalStyles, IconButton, Portal } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import GuidedTourStateManager from '../../managers/GuidedTourStateManager';
export const GenericGuidedTour = ({
  run,
  onFinish,
  steps,
  tourType = 'mainTour',
  callback,
  stepIndex: controlledStepIndex,
}) => {
  const theme = useTheme();
  const [internalStepIndex, setInternalStepIndex] = useState(0);
  const [showOnNextStartup, setShowOnNextStartup] = useState(true);
  // Get tour state manager instance
  const tourManager = GuidedTourStateManager.getInstance();
  // Use controlled step index if provided, otherwise use internal state
  const stepIndex = controlledStepIndex !== undefined ? controlledStepIndex : internalStepIndex;
  const handleCheckboxChange = useCallback(
    (checked) => {
      setShowOnNextStartup(checked);
      // Note: We invert the logic here - if showOnNextStartup is false, the tour is disabled
      tourManager.setTourDisabled(tourType, !checked);
    },
    [tourManager, tourType]
  );
  // Handle tour start logic
  useEffect(() => {
    if (run && controlledStepIndex === undefined) {
      // Start tour when run prop is true (for uncontrolled tours)
      setInternalStepIndex(0);
    }
  }, [run, controlledStepIndex]);
  // Add keyboard event listener for ESC key
  useEffect(() => {
    if (!run) return;
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        // Trigger tour completion
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
    (data) => {
      const { status, type, index, action } = data;
      const finishedStatuses = [STATUS.FINISHED, STATUS.SKIPPED];
      // Call external callback if provided
      callback?.(data);
      // Check for errors
      if (status === 'error') {
        // Try to recover by moving to next step
        if (index !== undefined && index < steps.length - 1 && controlledStepIndex === undefined) {
          setInternalStepIndex(index + 1);
        }
      }
      // Handle ESC key press (action will be 'close' when ESC is pressed)
      if (action === 'close' || finishedStatuses.includes(status)) {
        // Mark tour as completed using the unified manager
        tourManager.markTourCompleted(tourType);
        // Also save the checkbox preference if it was set
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
        // Move to next step only when "Next" button is clicked (only for uncontrolled tours)
        setInternalStepIndex(index + 1);
      } else if (
        type === 'step:after' &&
        action === 'prev' &&
        index !== undefined &&
        controlledStepIndex === undefined
      ) {
        // Move to previous step when "Back" button is clicked (only for uncontrolled tours)
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
  const joyrideStyles = {
    options: {
      primaryColor: theme.palette.primary.main,
      textColor: theme.palette.text.primary,
      backgroundColor: theme.palette.background.paper,
      arrowColor: theme.palette.background.paper,
      overlayColor: theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.3)', // Reduced backdrop overlay for better visibility
      zIndex: 10001,
      spotlightPadding: 8, // Add padding around highlighted element
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
          : '0 8px 24px rgba(0,0,0,0.25)', // Stronger shadow for tooltip
    },
    tooltipContent: {
      padding: '20px',
    },
    spotlight: {
      backgroundColor: 'transparent',
      border: '3px solid #ffeb3b', // Yellow border for visibility
      borderRadius: '8px', // Slightly rounded corners
      boxShadow: '0 0 20px rgba(255, 235, 59, 0.8), 0 0 40px rgba(255, 235, 59, 0.4)', // Glowing effect
      animation: 'pulse 2s ease-in-out infinite',
    },
    overlay: {
      backgroundColor: theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.3)', // Reduced backdrop for better visibility
      backdropFilter: 'blur(0.5px)', // Further reduced blur for better visibility
    },
  };
  // Event handlers for footer buttons - defined outside CustomFooter to avoid hooks in callbacks
  const handleFooterPrimaryEnter = useCallback(
    (e) => {
      e.currentTarget.style.backgroundColor = theme.palette.primary.dark;
      e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
    },
    [theme.palette.primary.dark]
  );
  const handleFooterPrimaryLeave = useCallback(
    (e) => {
      e.currentTarget.style.backgroundColor = theme.palette.primary.main;
      e.currentTarget.style.boxShadow = 'none';
    },
    [theme.palette.primary.main]
  );
  // Custom footer component with checkbox - defined inside to access theme and handlers
  const CustomFooter = useCallback(
    ({ primaryProps, backProps, index }) => {
      return _jsxs(Box, {
        sx: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          mt: 0,
          backgroundColor: theme.palette.mode === 'dark' ? theme.palette.grey[900] : '#f8f8f8',
          padding: '15px 20px',
          boxSizing: 'border-box',
        },
        children: [
          _jsxs(Box, {
            sx: { display: 'flex', alignItems: 'center', gap: 2, flex: 1 },
            children: [
              _jsx('button', {
                ...(backProps || {}),
                disabled: index === 0,
                style: {
                  backgroundColor: 'transparent',
                  border: `1px solid ${theme.palette.mode === 'dark' ? theme.palette.divider : '#ccc'}`,
                  color: index === 0 ? theme.palette.text.disabled : theme.palette.text.secondary,
                  cursor: index === 0 ? 'default' : 'pointer',
                  fontSize: '16px',
                  fontWeight: 500,
                  padding: '10px 20px',
                  borderRadius: '4px',
                  transition: 'all 0.2s',
                  opacity: index === 0 ? 0.5 : 1,
                },
                children: 'Back',
              }),
              _jsx(FormControlLabel, {
                control: _jsx(Checkbox, {
                  checked: showOnNextStartup,
                  onChange: (e) => handleCheckboxChange(e.target.checked),
                  size: 'medium',
                }),
                label: 'Show tour on next startup',
                sx: {
                  fontSize: '1rem',
                  color: 'text.secondary',
                  mr: 1,
                  '& .MuiFormControlLabel-label': {
                    fontSize: '1rem',
                  },
                },
              }),
            ],
          }),
          _jsx('button', {
            ...primaryProps,
            style: {
              backgroundColor: theme.palette.primary.main,
              color: theme.palette.primary.contrastText,
              border: 'none',
              borderRadius: '4px',
              padding: '10px 24px',
              fontSize: '16px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
            },
            onMouseEnter: handleFooterPrimaryEnter,
            onMouseLeave: handleFooterPrimaryLeave,
            children: primaryProps.title,
          }),
        ],
      });
    },
    [
      showOnNextStartup,
      handleCheckboxChange,
      handleFooterPrimaryEnter,
      handleFooterPrimaryLeave,
      theme,
    ]
  );
  // Tooltip render function
  const renderTooltip = useCallback(
    ({ index, step, backProps, primaryProps, skipProps, tooltipProps }) => {
      return _jsxs('div', {
        ...tooltipProps,
        style: {
          padding: 0,
          overflow: 'hidden',
          borderRadius: '20px',
          position: 'relative',
        },
        children: [
          _jsx(IconButton, {
            onClick: skipProps?.onClick,
            sx: {
              position: 'absolute',
              top: 8,
              right: 8,
              zIndex: 1,
              color: 'text.secondary',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.04)',
              },
            },
            size: 'small',
            'aria-label': 'Close tour',
            children: _jsx(CloseIcon, { fontSize: 'small' }),
          }),
          _jsx('div', {
            style: {
              padding: '20px',
              backgroundColor: theme.palette.background.paper,
            },
            children: step.content,
          }),
          _jsx(CustomFooter, { primaryProps: primaryProps, backProps: backProps, index: index }),
        ],
      });
    },
    [CustomFooter, theme.palette.background.paper]
  );
  return _jsxs(Portal, {
    children: [
      _jsx(GlobalStyles, {
        styles: {
          '@keyframes pulse': {
            '0%': {
              boxShadow: '0 0 20px rgba(255, 235, 59, 0.8), 0 0 40px rgba(255, 235, 59, 0.4)',
              transform: 'scale(1)',
            },
            '50%': {
              boxShadow: '0 0 30px rgba(255, 235, 59, 1), 0 0 60px rgba(255, 235, 59, 0.6)',
              transform: 'scale(1.02)',
            },
            '100%': {
              boxShadow: '0 0 20px rgba(255, 235, 59, 0.8), 0 0 40px rgba(255, 235, 59, 0.4)',
              transform: 'scale(1)',
            },
          },
          // Reduced backdrop overlay for better visibility
          '.react-joyride__overlay': {
            backgroundColor:
              theme.palette.mode === 'dark'
                ? 'rgba(0, 0, 0, 0.4) !important'
                : 'rgba(0, 0, 0, 0.3) !important',
            backdropFilter: 'blur(0.5px) !important',
          },
          // Enhanced spotlight with glowing border
          '.react-joyride__spotlight': {
            backgroundColor: 'transparent !important',
            border: '3px solid #ffeb3b !important',
            borderRadius: '8px !important',
            animation: 'pulse 2s ease-in-out infinite !important',
            boxShadow:
              '0 0 20px rgba(255, 235, 59, 0.8), 0 0 40px rgba(255, 235, 59, 0.4) !important',
            transition: 'all 0.3s ease !important',
          },
          // Ensure tooltip has higher z-index and stands out
          '.react-joyride__tooltip': {
            boxShadow:
              theme.palette.mode === 'dark'
                ? '0 12px 40px rgba(0,0,0,0.8), 0 0 80px rgba(255, 235, 59, 0.2) !important'
                : '0 12px 40px rgba(0,0,0,0.3), 0 0 80px rgba(255, 235, 59, 0.2) !important',
            zIndex: 10002,
          },
        },
      }),
      _jsx(Joyride, {
        steps: steps,
        run: run,
        continuous: true,
        showSkipButton: true,
        showProgress: true,
        stepIndex: stepIndex,
        callback: handleJoyrideCallback,
        styles: joyrideStyles,
        locale: {
          back: 'Back',
          close: 'Close',
          last: 'Finish',
          next: 'Next',
          skip: 'Cancel Tour',
        },
        floaterProps: {
          disableAnimation: false,
          hideArrow: false,
          offset: 10,
        },
        disableScrolling: false,
        disableCloseOnEsc: false,
        hideCloseButton: true,
        spotlightClicks: true,
        scrollToFirstStep: false,
        scrollOffset: 10,
        debug: false,
        tooltipComponent: renderTooltip,
        disableOverlay: false,
        disableOverlayClose: true,
        spotlightPadding: 8,
      }),
    ],
  });
};
//# sourceMappingURL=GenericGuidedTour.js.map
