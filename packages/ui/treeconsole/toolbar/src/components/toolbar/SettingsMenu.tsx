import {
  CheckBox,
  Edit,
  Settings as SettingsIcon,
  Save,
} from '@mui/icons-material';
import {
  Box,
  Divider,
  FormControlLabel,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Slider,
  Switch,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { TreeConsoleToolbarActionParams } from '../../types.js';

const SHARED_ZOOM_RANGE_KEY = 'sharedZoomRange';
const DEFAULT_SHARED_ZOOM_RANGE: [number, number] = [4, 12];
const SHARED_ZOOM_RANGE_MIN = 0;
const SHARED_ZOOM_RANGE_MAX = 22;

const normalizeSharedZoomRange = (value: unknown): [number, number] => {
  if (!Array.isArray(value) || value.length < 2) {
    return DEFAULT_SHARED_ZOOM_RANGE;
  }
  const rawMin = Number(value[0]);
  const rawMax = Number(value[1]);
  const min = Number.isFinite(rawMin) ? rawMin : DEFAULT_SHARED_ZOOM_RANGE[0];
  const max = Number.isFinite(rawMax) ? rawMax : DEFAULT_SHARED_ZOOM_RANGE[1];
  const clampedMin = Math.min(Math.max(min, SHARED_ZOOM_RANGE_MIN), SHARED_ZOOM_RANGE_MAX);
  const clampedMax = Math.min(Math.max(max, SHARED_ZOOM_RANGE_MIN), SHARED_ZOOM_RANGE_MAX);
  return clampedMin <= clampedMax ? [clampedMin, clampedMax] : [clampedMax, clampedMin];
};

const readSharedZoomRange = (): [number, number] => {
  if (typeof window === 'undefined') {
    return DEFAULT_SHARED_ZOOM_RANGE;
  }
  const stored = window.localStorage?.getItem(SHARED_ZOOM_RANGE_KEY);
  if (!stored) {
    return DEFAULT_SHARED_ZOOM_RANGE;
  }
  try {
    const parsed = JSON.parse(stored);
    return normalizeSharedZoomRange(parsed);
  } catch (error) {
    console.warn('[TreeConsoleToolbar] Failed to parse shared zoom range', error);
    return DEFAULT_SHARED_ZOOM_RANGE;
  }
};

interface SettingsMenuProps {
  rowClickAction: 'Select/Navigate' | 'Edit';
  onRowClickActionChange?: (action: 'Select/Navigate' | 'Edit') => void;
  autosaveEnabled: boolean;
  onAutosaveEnabledChange?: (enabled: boolean) => void;
  onAction: (action: string, params?: TreeConsoleToolbarActionParams) => void;
  portalContainer?: HTMLElement;
  labels: {
    settingsButton: string;
    rowClickTitle: string;
    rowClickSelectNavigate: string;
    rowClickEdit: string;
    autosaveTitle: string;
    sharedZoomRangeTitle: string;
    sharedZoomRangeHelper: string;
  };
}

export function SettingsMenu({
  rowClickAction,
  onRowClickActionChange,
  autosaveEnabled,
  onAutosaveEnabledChange,
  onAction,
  portalContainer,
  labels,
}: SettingsMenuProps) {
  const [settingsAnchorEl, setSettingsAnchorEl] = useState<HTMLElement | null>(null);
  const [sharedZoomRange, setSharedZoomRange] = useState<[number, number]>(() => readSharedZoomRange());

  const settingsOpen = Boolean(settingsAnchorEl);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage?.setItem(SHARED_ZOOM_RANGE_KEY, JSON.stringify(sharedZoomRange));
  }, [sharedZoomRange]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== SHARED_ZOOM_RANGE_KEY) return;
      setSharedZoomRange(readSharedZoomRange());
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const scheduleCloseSettingsMenu = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        setSettingsAnchorEl(null);
      }, 0);
    } else {
      setSettingsAnchorEl(null);
    }
  }, []);

  const handleSettingsClick = (event: React.MouseEvent<HTMLElement>) => {
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

  const sharedZoomLabel = useMemo(() => {
    const [minZoom, maxZoom] = sharedZoomRange;
    return `${minZoom} - ${maxZoom}`;
  }, [sharedZoomRange]);

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
              minWidth: 250,
              zIndex: (theme) => Math.max(theme.zIndex.modal + 2, 2001),
            }}
          >
            <Typography variant="subtitle2" gutterBottom>
              {labels.rowClickTitle}
            </Typography>
            <RadioGroup value={rowClickAction} onChange={(e) => handleRowClickChange(e.target.value as 'Select/Navigate' | 'Edit')}>
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

            <Divider sx={{ my: 1.5 }} />

            <Typography variant="subtitle2" gutterBottom>
              {labels.sharedZoomRangeTitle}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {labels.sharedZoomRangeHelper}
            </Typography>
            <Box sx={{ px: 1 }}>
              <Slider
                value={sharedZoomRange}
                onChange={(_, value) => {
                  if (!Array.isArray(value)) return;
                  setSharedZoomRange(normalizeSharedZoomRange(value));
                }}
                min={SHARED_ZOOM_RANGE_MIN}
                max={SHARED_ZOOM_RANGE_MAX}
                step={1}
                valueLabelDisplay="auto"
              />
            </Box>
            <Typography variant="caption" color="text.secondary">
              {sharedZoomLabel}
            </Typography>
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
