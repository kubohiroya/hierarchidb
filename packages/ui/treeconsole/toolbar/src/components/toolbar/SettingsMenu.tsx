import {
  TREE_CONSOLE_ZOOM_BAND_MAX_RANGES,
  TREE_CONSOLE_ZOOM_BAND_MAX_ZOOM,
  TREE_CONSOLE_ZOOM_BAND_MIN_RANGES,
  TREE_CONSOLE_ZOOM_BAND_MIN_ZOOM,
} from '@hierarchidb/util';
import {
  CheckBox,
  DisabledByDefault,
  Edit,
  Save,
  Settings as SettingsIcon,
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
import { type ReactNode } from 'react';
import type { TreeConsoleToolbarActionParams } from '~/types';
import { useSettingsMenu } from './useSettingsMenu.js';

interface SettingsMenuProps {
  rowClickAction: 'Select/Navigate' | 'Edit';
  onRowClickActionChange?: (action: 'Select/Navigate' | 'Edit') => void;
  autosaveEnabled: boolean;
  onAutosaveEnabledChange?: (enabled: boolean) => void;
  dialogBackdropDismissEnabled: boolean;
  onDialogBackdropDismissEnabledChange?: (enabled: boolean) => void;
  zoomBandBoundaries?: number[];
  onZoomBandBoundariesChange?: (boundaries: number[]) => void;
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
  onAction,
  portalContainer,
  labels,
}: SettingsMenuProps) {
  const {
    settingsAnchorEl,
    settingsOpen,
    rangeCount,
    sliderValues,
    handleSettingsClick,
    handleMenuClose,
    handleRowClickChange,
    handleAutosaveChange,
    handleDialogBackdropDismissChange,
    handleRangeCountChange,
    handleBoundariesChange,
  } = useSettingsMenu({
    onRowClickActionChange,
    onAutosaveEnabledChange,
    onDialogBackdropDismissEnabledChange,
    zoomBandBoundaries,
    onZoomBandBoundariesChange,
    onAction,
  });

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
        onClose={handleMenuClose}
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
                  <LabelWithIcon
                    icon={<CheckBox fontSize="small" />}
                    text={labels.rowClickSelectNavigate}
                  />
                }
              />
              <FormControlLabel
                value="Edit"
                control={<Radio size="small" />}
                label={
                  <LabelWithIcon icon={<Edit fontSize="small" />} text={labels.rowClickEdit} />
                }
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
