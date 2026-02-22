import {
  CheckBox,
  DisabledByDefault,
  Edit,
  Settings as SettingsIcon,
  Save,
} from '@mui/icons-material';
import {
  Divider,
  FormControlLabel,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Slider,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import {
  TREE_CONSOLE_DEFAULT_ZOOM_BAND_BOUNDARIES,
  TREE_CONSOLE_ZOOM_BAND_MAX_RANGES,
  TREE_CONSOLE_ZOOM_BAND_MAX_ZOOM,
  TREE_CONSOLE_ZOOM_BAND_MIN_RANGES,
  TREE_CONSOLE_ZOOM_BAND_MIN_ZOOM,
  buildEvenZoomBandBoundaries,
  normalizeZoomBandBoundaries,
} from '@hierarchidb/util';
import { useCallback, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import type { BuildContinuationPolicy } from '../../../../../../build-api';
import type { TreeConsoleToolbarActionParams } from '~/types';

interface SettingsMenuProps {
  rowClickAction: 'Select/Navigate' | 'Edit';
  onRowClickActionChange?: (action: 'Select/Navigate' | 'Edit') => void;
  autosaveEnabled: boolean;
  onAutosaveEnabledChange?: (enabled: boolean) => void;
  dialogBackdropDismissEnabled: boolean;
  onDialogBackdropDismissEnabledChange?: (enabled: boolean) => void;
  zoomBandBoundaries?: number[];
  onZoomBandBoundariesChange?: (boundaries: number[]) => void;
  buildContinuationPolicy: BuildContinuationPolicy;
  onBuildContinuationPolicyChange?: (policy: BuildContinuationPolicy) => void;
  onAction: (action: string, params?: TreeConsoleToolbarActionParams) => void;
  portalContainer?: HTMLElement;
  labels: {
    settingsButton: string;
    rowClickTitle: string;
    rowClickSelectNavigate: string;
    rowClickEdit: string;
    autosaveTitle: string;
    dialogBackdropDismissTitle: string;
    zoomBandsTitle: string;
    zoomBandsHelper: string;
    zoomBandsSummary: string;
    zoomBandsRangeCount: string;
    zoomBandsRangeCountHelp: string;
    zoomBandsBoundaries: string;
    zoomBandsBoundariesHelp: string;
    buildPolicyTitle: string;
    buildPolicyHelper: string;
    buildPolicyFinishAll: string;
    buildPolicyFinishStage: string;
    buildPolicyStop: string;
  };
}

export function SettingsMenu({
  rowClickAction,
  onRowClickActionChange,
  autosaveEnabled,
  onAutosaveEnabledChange,
  dialogBackdropDismissEnabled,
  onDialogBackdropDismissEnabledChange,
  zoomBandBoundaries,
  onZoomBandBoundariesChange,
  buildContinuationPolicy,
  onBuildContinuationPolicyChange,
  onAction,
  portalContainer,
  labels,
}: SettingsMenuProps) {
  const [settingsAnchorEl, setSettingsAnchorEl] = useState<HTMLElement | null>(null);

  const settingsOpen = Boolean(settingsAnchorEl);
  const resolvedBoundaries = Array.isArray(zoomBandBoundaries)
    ? zoomBandBoundaries
    : TREE_CONSOLE_DEFAULT_ZOOM_BAND_BOUNDARIES;
  const normalizedBoundaries = useMemo(
    () =>
      normalizeZoomBandBoundaries(
        resolvedBoundaries,
        TREE_CONSOLE_ZOOM_BAND_MIN_ZOOM,
        TREE_CONSOLE_ZOOM_BAND_MAX_ZOOM,
        TREE_CONSOLE_ZOOM_BAND_MAX_RANGES,
      ),
    [resolvedBoundaries],
  );

  const rangeCount = Math.min(
    Math.max(normalizedBoundaries.length - 1, TREE_CONSOLE_ZOOM_BAND_MIN_RANGES),
    TREE_CONSOLE_ZOOM_BAND_MAX_RANGES,
  );
  const sliderValues = normalizedBoundaries;

  const scheduleCloseSettingsMenu = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        setSettingsAnchorEl(null);
      }, 0);
    } else {
      setSettingsAnchorEl(null);
    }
  }, []);

  const handleSettingsClick = (event: MouseEvent<HTMLElement>) => {
    setSettingsAnchorEl(event.currentTarget);
  };

  const handleRowClickChange = (value: 'Select/Navigate' | 'Edit') => {
    if (onRowClickActionChange) {
      onRowClickActionChange(value);
    } else {
      onAction('setRowClickAction', value);
    }
    scheduleCloseSettingsMenu();
  };

  const handleAutosaveChange = (value: boolean) => {
    if (onAutosaveEnabledChange) {
      onAutosaveEnabledChange(value);
    } else {
      onAction('setAutosaveEnabled', value);
    }
    scheduleCloseSettingsMenu();
  };

  const handleDialogBackdropDismissChange = (value: boolean) => {
    if (onDialogBackdropDismissEnabledChange) {
      onDialogBackdropDismissEnabledChange(value);
    } else {
      onAction('setDialogBackdropDismissEnabled', value);
    }
    scheduleCloseSettingsMenu();
  };

  const handleZoomBandBoundariesChange = (nextBoundaries: number[]) => {
    if (onZoomBandBoundariesChange) {
      onZoomBandBoundariesChange(nextBoundaries);
    } else {
      onAction('setZoomBandBoundaries', nextBoundaries);
    }
  };

  const handleRangeCountChange = (_event: Event, value: number | number[]) => {
    const raw = Array.isArray(value) ? value[0] : value;
    if (typeof raw !== 'number') return;
    const currentMax = normalizedBoundaries[normalizedBoundaries.length - 1] ?? TREE_CONSOLE_ZOOM_BAND_MAX_ZOOM;
    const nextBoundaries = buildEvenZoomBandBoundaries(
      raw,
      TREE_CONSOLE_ZOOM_BAND_MIN_ZOOM,
      currentMax,
    );
    handleZoomBandBoundariesChange(nextBoundaries);
  };

  const handleBuildContinuationPolicyChange = (nextPolicy: BuildContinuationPolicy) => {
    if (onBuildContinuationPolicyChange) {
      onBuildContinuationPolicyChange(nextPolicy);
    } else {
      onAction('setBuildContinuationPolicy', nextPolicy);
    }
    scheduleCloseSettingsMenu();
  };

  const handleBoundariesChange = (_event: Event, value: number | number[]) => {
    if (!Array.isArray(value)) return;
    const nextValues = [...value];
    if (nextValues.length > 0) {
      nextValues[0] = TREE_CONSOLE_ZOOM_BAND_MIN_ZOOM;
    }
    const nextBoundaries = normalizeZoomBandBoundaries(
      nextValues,
      TREE_CONSOLE_ZOOM_BAND_MIN_ZOOM,
      TREE_CONSOLE_ZOOM_BAND_MAX_ZOOM,
      TREE_CONSOLE_ZOOM_BAND_MAX_RANGES,
    );
    handleZoomBandBoundariesChange(nextBoundaries);
  };

  return (
    <>
      <IconButton
        size="small"
        onClick={handleSettingsClick}
        aria-label={labels.settingsButton}
        title={labels.settingsButton}
      >
        <SettingsIcon fontSize="small" />
      </IconButton>
      <Menu
        open={settingsOpen}
        anchorEl={settingsAnchorEl}
        container={portalContainer}
        onClose={() => setSettingsAnchorEl(null)}
      >
        <MenuItem>
          <Paper
            sx={{
              p: 2,
              minWidth: 280,
              zIndex: (theme) => Math.max(theme.zIndex.modal + 2, 2001),
            }}
          >
            <Typography variant="subtitle2" gutterBottom>
              {labels.rowClickTitle}
            </Typography>
            <RadioGroup
              value={rowClickAction}
              onChange={(e) => handleRowClickChange(e.target.value as 'Select/Navigate' | 'Edit')}
            >
              <FormControlLabel
                value="Select/Navigate"
                control={<Radio size="small" />}
                label={
                  <LabelWithIcon icon={<CheckBox fontSize="small" />} text={labels.rowClickSelectNavigate} />
                }
              />
              <FormControlLabel
                value="Edit"
                control={<Radio size="small" />}
                label={<LabelWithIcon icon={<Edit fontSize="small" />} text={labels.rowClickEdit} />}
              />
            </RadioGroup>

            <Divider sx={{ my: 1.5 }} />

            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={autosaveEnabled}
                  onChange={(e) => handleAutosaveChange(e.target.checked)}
                />
              }
              label={<LabelWithIcon icon={<Save fontSize="small" />} text={labels.autosaveTitle} />}
            />

            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={dialogBackdropDismissEnabled}
                  onChange={(e) => handleDialogBackdropDismissChange(e.target.checked)}
                />
              }
              label={
                <LabelWithIcon
                  icon={<DisabledByDefault fontSize="small" />}
                  text={labels.dialogBackdropDismissTitle}
                />
              }
            />

            <Divider sx={{ my: 1.5 }} />

            <Typography variant="subtitle2" gutterBottom>
              {labels.zoomBandsTitle}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {labels.zoomBandsHelper}
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
              {labels.zoomBandsSummary}
            </Typography>

            <Stack spacing={1.5} sx={{ mt: 1.5 }}>
              <Stack spacing={0.5}>
                <Typography variant="body2" fontWeight={600}>
                  {labels.zoomBandsRangeCount}
                </Typography>
                <Slider
                  sx={{ mt: '36px !important' }}
                  value={rangeCount}
                  min={TREE_CONSOLE_ZOOM_BAND_MIN_RANGES}
                  max={TREE_CONSOLE_ZOOM_BAND_MAX_RANGES}
                  step={1}
                  marks
                  valueLabelDisplay="on"
                  onChange={handleRangeCountChange}
                  getAriaLabel={() => labels.zoomBandsRangeCount}
                />
                <Typography variant="caption" color="text.secondary">
                  {labels.zoomBandsRangeCountHelp}
                </Typography>
              </Stack>
              <Stack spacing={0.5}>
                <Typography variant="body2" fontWeight={600}>
                  {labels.zoomBandsBoundaries}
                </Typography>
                <Slider
                  sx={{ mt: '36px !important' }}
                  value={sliderValues}
                  min={TREE_CONSOLE_ZOOM_BAND_MIN_ZOOM}
                  max={TREE_CONSOLE_ZOOM_BAND_MAX_ZOOM}
                  step={1}
                  marks
                  disableSwap
                  valueLabelDisplay="on"
                  onChange={handleBoundariesChange}
                  getAriaLabel={() => labels.zoomBandsBoundaries}
                />
                <Typography variant="caption" color="text.secondary">
                  {labels.zoomBandsBoundariesHelp}
                </Typography>
              </Stack>
            </Stack>

            <Divider sx={{ my: 1.5 }} />

            <Typography variant="subtitle2" gutterBottom>
              {labels.buildPolicyTitle}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {labels.buildPolicyHelper}
            </Typography>
            <RadioGroup
              value={buildContinuationPolicy}
              onChange={(e) => handleBuildContinuationPolicyChange(e.target.value as BuildContinuationPolicy)}
            >
              <FormControlLabel
                value="finish_all_stages"
                control={<Radio size="small" />}
                label={labels.buildPolicyFinishAll}
              />
              <FormControlLabel
                value="finish_stage_then_stop"
                control={<Radio size="small" />}
                label={labels.buildPolicyFinishStage}
              />
              <FormControlLabel
                value="stop_on_first_error"
                control={<Radio size="small" />}
                label={labels.buildPolicyStop}
              />
            </RadioGroup>
          </Paper>
        </MenuItem>

        <Divider sx={{ my: 1 }} />
      </Menu>
    </>
  );
}

function LabelWithIcon({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {icon}
      <Typography component="span" variant="body2">
        {text}
      </Typography>
    </span>
  );
}
