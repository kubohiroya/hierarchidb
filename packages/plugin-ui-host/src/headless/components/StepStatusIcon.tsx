import ApprovalIcon from '@mui/icons-material/Approval';
import BookmarksIcon from '@mui/icons-material/Bookmarks';
import CheckIcon from '@mui/icons-material/Check';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import ConstructionIcon from '@mui/icons-material/Construction';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import InfoIcon from '@mui/icons-material/Info';
import PaletteIcon from '@mui/icons-material/Palette';
import PublicIcon from '@mui/icons-material/Public';
import SettingsIcon from '@mui/icons-material/Settings';
import VisibilityIcon from '@mui/icons-material/Visibility';
import type { SvgIconComponent } from '@mui/icons-material';
import { Box, CircularProgress, type Theme } from '@mui/material';
import type { StepIconProps } from '@mui/material/StepIcon';
import { alpha } from '@mui/material/styles';

const normalizeStepId = (stepId: string): string => stepId.trim().toLowerCase();

const STEP_ICON_BY_ID: Record<string, SvgIconComponent> = {
  'basic-info': InfoIcon,
  info: InfoIcon,
  'data-source': CloudDownloadIcon,
  preview: VisibilityIcon,
  'style-preview': VisibilityIcon,
  'map-preview': VisibilityIcon,
  'country-selection': PublicIcon,
  selection: PublicIcon,
  'route-config': PublicIcon,
  processing: SettingsIcon,
  'processing-configuration': SettingsIcon,
  'style-filter': FilterAltIcon,
  'mapping-keys': BookmarksIcon,
  'target-behavior': ApprovalIcon,
  'style-scaling': PaletteIcon,
  build: ConstructionIcon,
  stage: ConstructionIcon,
};

const resolveStepIcon = (stepId?: string): SvgIconComponent | null => {
  if (!stepId) return null;
  const normalized = normalizeStepId(stepId);
  return STEP_ICON_BY_ID[normalized] ?? null;
};

export const StepStatusIcon = (
  props: StepIconProps & {
    variant?: 'validated-disabled';
    stepIndex?: number;
    stepId?: string;
    canNavigate?: boolean;
    inProgress?: boolean;
    theme: Theme;
  }
) => {
  const {
    theme,
    active,
    completed,
    icon: iconProp,
    variant,
    stepIndex,
    stepId,
    canNavigate = true,
    inProgress = false,
  } = props;
  const MappedStepIcon = resolveStepIcon(stepId);
  const isValidatedDisabled = variant === 'validated-disabled';
  const isDisabled = !canNavigate;
  const disabledBg =
    theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[300];
  const baseColor = active
    ? theme.palette.primary.main
    : isDisabled
      ? disabledBg
      : theme.palette.background.paper;
  const textColor = active
    ? theme.palette.common.white
    : isDisabled
      ? theme.palette.text.disabled
      : theme.palette.text.primary;
  const borderColor = active
    ? theme.palette.primary.main
    : isDisabled
      ? disabledBg
      : theme.palette.divider;
  const boxShadow = active
    ? `0 0 0 2px ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.5 : 0.3)}`
    : 'none';

  return (
    <Box
      data-testid={`plugin-dialog-step-icon-${iconProp}`}
      data-active={active ? 'true' : 'false'}
      data-validated={completed ? 'true' : 'false'}
      data-valid-disabled={isValidatedDisabled ? 'true' : 'false'}
      data-in-progress={inProgress ? 'true' : 'false'}
      sx={{
        width: 30,
        height: 30,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: baseColor,
        color: textColor,
        border: '2px solid',
        borderColor,
        fontWeight: 600,
        fontSize: 13,
        transition: theme.transitions.create(['background-color', 'border-color', 'color'], {
          duration: theme.transitions.duration.short,
        }),
        boxShadow,
        position: 'relative',
      }}
    >
      {inProgress ? (
        <CircularProgress size={16} thickness={5} color="inherit" />
      ) : MappedStepIcon ? (
        <MappedStepIcon sx={{ fontSize: 16 }} />
      ) : typeof stepIndex === 'number' ? (
        stepIndex + 1
      ) : (
        iconProp
      )}
      {completed && !inProgress && (
        <CheckIcon
          fontSize="inherit"
          sx={{
            position: 'absolute',
            top: -10,
            right: -14,
            width: 16,
            height: 16,
            bgcolor: theme.palette.background.paper,
            color: isValidatedDisabled ? theme.palette.text.disabled : theme.palette.success.main,
            borderRadius: '50%',
            border: `1px solid ${
              isValidatedDisabled ? theme.palette.text.disabled : theme.palette.success.main
            }`,
            p: 0.25,
          }}
        />
      )}
    </Box>
  );
};
