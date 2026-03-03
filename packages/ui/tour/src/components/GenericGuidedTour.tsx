import { Close as CloseIcon } from '@mui/icons-material';
import { Box, Checkbox, FormControlLabel, GlobalStyles, IconButton, Portal } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import Joyride, { type CallBackProps, type Step } from 'react-joyride';
import { useGenericGuidedTour } from './useGenericGuidedTour';

export interface GenericGuidedTourProps {
  run: boolean;
  onFinish?: () => void;
  steps: Step[];
  tourType?: string;
  callback?: (data: CallBackProps) => void;
  stepIndex?: number;
}

export const GenericGuidedTour = ({
  run,
  onFinish,
  steps,
  tourType = 'mainTour',
  callback,
  stepIndex: controlledStepIndex,
}: GenericGuidedTourProps) => {
  const theme = useTheme();
  const {
    checkboxId,
    stepIndex,
    showOnNextStartup,
    handleCheckboxChange,
    handleJoyrideCallback,
    joyrideStyles,
    handleFooterPrimaryEnter,
    handleFooterPrimaryLeave,
  } = useGenericGuidedTour({
    run,
    onFinish,
    steps,
    tourType,
    callback,
    controlledStepIndex,
    theme,
  });

  const CustomFooter = ({
    primaryProps,
    backProps,
    index,
  }: {
    primaryProps: { title: string; [key: string]: unknown };
    backProps?: { title: string; [key: string]: unknown };
    index: number;
  }) => (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        mt: 0,
        backgroundColor: theme.palette.mode === 'dark' ? theme.palette.grey[900] : '#f8f8f8',
        padding: '15px 20px',
        boxSizing: 'border-box',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
        <button
          {...(backProps || {})}
          disabled={index === 0}
          style={{
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
          }}
        >
          Back
        </button>

        <FormControlLabel
          control={
            <Checkbox
              checked={showOnNextStartup}
              onChange={(e) => handleCheckboxChange(e.target.checked)}
              size="medium"
              inputProps={{
                id: `${checkboxId}-show-on-next-startup`,
                name: 'show-on-next-startup',
              }}
            />
          }
          label="Show tour on next startup"
          sx={{
            fontSize: '1rem',
            color: 'text.secondary',
            mr: 1,
            '& .MuiFormControlLabel-label': {
              fontSize: '1rem',
            },
          }}
        />
      </Box>

      <button
        {...primaryProps}
        style={{
          backgroundColor: theme.palette.primary.main,
          color: theme.palette.primary.contrastText,
          border: 'none',
          borderRadius: '4px',
          padding: '10px 24px',
          fontSize: '16px',
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
        onMouseEnter={handleFooterPrimaryEnter}
        onMouseLeave={handleFooterPrimaryLeave}
      >
        {primaryProps.title}
      </button>
    </Box>
  );

  const renderTooltip = ({
    index,
    step,
    backProps,
    primaryProps,
    skipProps,
    tooltipProps,
  }: {
    index: number;
    step: Step;
    backProps?: { title: string; [key: string]: unknown };
    primaryProps: { title: string; [key: string]: unknown };
    skipProps?: { title: string; [key: string]: unknown };
    tooltipProps: Record<string, unknown>;
  }) => (
    <div
      {...tooltipProps}
      style={{
        padding: 0,
        overflow: 'hidden',
        borderRadius: '20px',
        position: 'relative',
      }}
    >
      <IconButton
        onClick={skipProps?.onClick as () => void}
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 1,
          color: 'text.secondary',
          '&:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.04)',
          },
        }}
        size="small"
        aria-label="Close tour"
      >
        <CloseIcon fontSize="small" />
      </IconButton>
      <div
        style={{
          padding: '20px',
          backgroundColor: theme.palette.background.paper,
        }}
      >
        {step.content}
      </div>
      <CustomFooter primaryProps={primaryProps} backProps={backProps} index={index} />
    </div>
  );

  return (
    <Portal>
      <GlobalStyles
        styles={{
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
          '.react-joyride__overlay': {
            backgroundColor:
              theme.palette.mode === 'dark'
                ? 'rgba(0, 0, 0, 0.4) !important'
                : 'rgba(0, 0, 0, 0.3) !important',
            backdropFilter: 'blur(0.5px) !important',
          },
          '.react-joyride__spotlight': {
            backgroundColor: 'transparent !important',
            border: '3px solid #ffeb3b !important',
            borderRadius: '8px !important',
            animation: 'pulse 2s ease-in-out infinite !important',
            boxShadow:
              '0 0 20px rgba(255, 235, 59, 0.8), 0 0 40px rgba(255, 235, 59, 0.4) !important',
            transition: 'all 0.3s ease !important',
          },
          '.react-joyride__tooltip': {
            boxShadow:
              theme.palette.mode === 'dark'
                ? '0 12px 40px rgba(0,0,0,0.8), 0 0 80px rgba(255, 235, 59, 0.2) !important'
                : '0 12px 40px rgba(0,0,0,0.3), 0 0 80px rgba(255, 235, 59, 0.2) !important',
            zIndex: 10002,
          },
        }}
      />
      <Joyride
        steps={steps}
        run={run}
        continuous
        showSkipButton
        showProgress
        stepIndex={stepIndex}
        callback={handleJoyrideCallback}
        styles={joyrideStyles}
        locale={{
          back: 'Back',
          close: 'Close',
          last: 'Finish',
          next: 'Next',
          skip: 'Cancel Tour',
        }}
        floaterProps={{
          hideArrow: false,
          offset: 10,
        }}
        disableScrolling={false}
        disableCloseOnEsc={false}
        hideCloseButton={true}
        spotlightClicks
        scrollToFirstStep={false}
        scrollOffset={10}
        debug={false}
        tooltipComponent={renderTooltip}
        disableOverlay={false}
        disableOverlayClose={true}
        spotlightPadding={8}
      />
    </Portal>
  );
};
