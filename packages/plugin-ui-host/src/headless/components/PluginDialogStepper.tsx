import {
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Step,
  StepButton,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import OpenInNewOffIcon from '@mui/icons-material/OpenInNewOff';
import type { Theme } from '@mui/material/styles';
import { useLocation } from '@tanstack/react-router';
import type React from 'react';
import { useCallback, useState } from 'react';
import { StepStatusIcon } from './StepStatusIcon.js';

type WorkerStepState = {
  id: string;
  enabled?: boolean;
  completed?: boolean;
  error?: string | null;
};
type WorkerDialogState = { steps?: WorkerStepState[] };
const STEP_ROUTE_BASE_SEGMENTS = 6;

export interface PluginDialogStepperProps {
  steps: { id: string; label?: string }[];
  activeStepIndex: number;
  enabledStepIndices: readonly number[];
  validatedStepIndices: readonly number[];
  handleStepClick: (event: React.MouseEvent, idx: number, canNavigate: boolean) => void;
  navigationLocked: boolean;
  workerStepMap?: Map<string, WorkerStepState> | null;
  dialogState?: WorkerDialogState | null;
  buildStepRunning?: boolean;
  theme: Theme;
}

const stripStepNumberPrefix = (label: string): string => label.replace(/^\s*\d+\.\s*/, '').trim();

const formatIndexedStepLabel = (label: string, stepIndex: number): string =>
  `${stepIndex + 1}. ${stripStepNumberPrefix(label)}`;

export const PluginDialogStepper: React.FC<PluginDialogStepperProps> = ({
  steps,
  activeStepIndex,
  enabledStepIndices,
  validatedStepIndices,
  handleStepClick,
  navigationLocked,
  workerStepMap,
  dialogState,
  buildStepRunning = false,
  theme,
}) => {
  const location = useLocation();
  const [contextMenuState, setContextMenuState] = useState<{
    mouseX: number;
    mouseY: number;
    url: string;
  } | null>(null);

  const toAbsoluteStepUrl = useCallback(
    (targetStep: number): string | null => {
      if (targetStep < 1 || !Number.isFinite(targetStep)) {
        return null;
      }
      const fallbackOrigin =
        typeof window !== 'undefined' && window.location?.origin
          ? window.location.origin
          : 'http://localhost';
      const candidate = new URL(
        `${location.pathname}${location.searchStr ?? ''}${location.hash ?? ''}`,
        fallbackOrigin
      );
      const segments = candidate.pathname.split('/').filter(Boolean);
      if (segments[0] !== 't' || segments.length < STEP_ROUTE_BASE_SEGMENTS) {
        return null;
      }
      const modeSegment = segments[6] ?? 'normal';
      const nextPathSegments = [
        ...segments.slice(0, STEP_ROUTE_BASE_SEGMENTS),
        modeSegment,
        String(targetStep),
      ];
      candidate.pathname = `/${nextPathSegments.join('/')}`;
      return candidate.toString();
    },
    [location.hash, location.pathname, location.searchStr]
  );

  const openStepContextMenu = useCallback(
    (event: React.MouseEvent, stepIndex: number, disabled: boolean) => {
      event.preventDefault();
      event.stopPropagation();
      if (disabled) {
        setContextMenuState(null);
        return;
      }
      const url = toAbsoluteStepUrl(stepIndex + 1);
      if (!url) {
        setContextMenuState(null);
        return;
      }
      setContextMenuState({
        mouseX: event.clientX + 2,
        mouseY: event.clientY - 6,
        url,
      });
    },
    [toAbsoluteStepUrl]
  );

  const closeContextMenu = useCallback(() => {
    setContextMenuState(null);
  }, []);

  const openInNewTab = useCallback(() => {
    if (!contextMenuState?.url) return;
    if (typeof window !== 'undefined') {
      window.open(contextMenuState.url, '_blank', 'noopener,noreferrer');
    }
    closeContextMenu();
  }, [closeContextMenu, contextMenuState?.url]);

  const openInNewWindow = useCallback(() => {
    if (!contextMenuState?.url) return;
    if (typeof window !== 'undefined') {
      window.open(contextMenuState.url, '_blank', 'noopener,noreferrer,popup=yes');
    }
    closeContextMenu();
  }, [closeContextMenu, contextMenuState?.url]);

  const copyLinkUrl = useCallback(async () => {
    if (!contextMenuState?.url) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(contextMenuState.url);
      } else if (typeof document !== 'undefined') {
        const textarea = document.createElement('textarea');
        textarea.value = contextMenuState.url;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
    } finally {
      closeContextMenu();
    }
  }, [closeContextMenu, contextMenuState?.url]);

  return (
    <>
      <Stepper nonLinear activeStep={activeStepIndex} alternativeLabel>
        {steps.map((step, index) => {
          const workerStep = workerStepMap?.get(step.id) ?? dialogState?.steps?.[index];
          const fallbackCanNavigate = enabledStepIndices.includes(index) || index === activeStepIndex;
          const canNavigate = workerStep?.enabled ?? fallbackCanNavigate;
          const completed = workerStep?.completed ?? validatedStepIndices.includes(index);
          const baseLabel = step.label ?? step.id;
          const label = formatIndexedStepLabel(baseLabel, index);
          const isActive = index === activeStepIndex;
          const previousWorkerStep =
            index > 0
              ? (workerStepMap?.get(steps[index - 1]?.id ?? '') ?? dialogState?.steps?.[index - 1])
              : null;
          const previousCompleted =
            index === 0
              ? true
              : (previousWorkerStep?.completed ?? validatedStepIndices.includes(index - 1));
          const isValidatedButDisabled = completed && !canNavigate && index > 0 && !previousCompleted;
          const showBuildProgress =
            step.id === 'build' && isActive && buildStepRunning && !completed;
          const isDisabled = !canNavigate || navigationLocked;

          return (
            <Step key={step.id} completed={completed}>
              <StepButton
                disabled={isDisabled}
                onClick={(event) => handleStepClick(event, index, canNavigate)}
                onContextMenu={(event) => openStepContextMenu(event, index, isDisabled)}
                aria-current={isActive ? 'step' : undefined}
                sx={{ padding: 0, margin: 0 }}
              >
                <StepLabel
                  slots={{
                    stepIcon: (props) => {
                      const iconIndex =
                        typeof props.icon === 'number' ? Number(props.icon) - 1 : index;
                      return (
                        <StepStatusIcon
                          {...props}
                          theme={theme}
                          stepIndex={iconIndex}
                          stepId={step.id}
                          canNavigate={canNavigate}
                          variant={isValidatedButDisabled ? 'validated-disabled' : undefined}
                          inProgress={showBuildProgress}
                        />
                      );
                    },
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={0.75}>
                    <Typography
                      variant="caption"
                      noWrap
                      sx={{
                        color: isActive ? 'primary.main' : 'text.secondary',
                        fontWeight: isActive ? 600 : 400,
                      }}
                      data-active-label={isActive ? 'true' : 'false'}
                    >
                      {label}
                    </Typography>
                  </Stack>
                </StepLabel>
              </StepButton>
            </Step>
          );
        })}
      </Stepper>
      <Menu
        open={Boolean(contextMenuState)}
        onClose={closeContextMenu}
        disableRestoreFocus
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenuState
            ? { top: contextMenuState.mouseY, left: contextMenuState.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={openInNewTab}>
          <ListItemIcon>
            <OpenInNewIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Open In New Tab</ListItemText>
        </MenuItem>
        <MenuItem onClick={openInNewWindow}>
          <ListItemIcon>
            <OpenInNewOffIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Open In New Window</ListItemText>
        </MenuItem>
        <MenuItem onClick={copyLinkUrl}>
          <ListItemIcon>
            <ContentCopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Copy Link URL</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
};

PluginDialogStepper.displayName = 'PluginDialogStepper';
