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
const DEFAULT_SHARED_ZOOM_RANGE: [number, number] = [0, 7];
const DEFAULT_SHARED_ZOOM_SEGMENTS = 2;
const DEFAULT_SHARED_ZOOM_BREAKPOINTS: number[] = [0, 4, 7];
const SHARED_ZOOM_RANGE_MIN = 0;
const SHARED_ZOOM_RANGE_MAX = 12;
const SHARED_ZOOM_SEGMENT_MIN = 1;
const SHARED_ZOOM_SEGMENT_MAX = 6;

type SharedZoomConfig = {
  range: [number, number];
  segments: number;
  breakpoints: number[];
};

const clampRange = (range: [number, number]): [number, number] => {
  const min = Math.min(Math.max(range[0], SHARED_ZOOM_RANGE_MIN), SHARED_ZOOM_RANGE_MAX);
  const max = Math.min(Math.max(range[1], SHARED_ZOOM_RANGE_MIN), SHARED_ZOOM_RANGE_MAX);
  return min <= max ? [min, max] : [max, min];
};

const distributeBreakpoints = (range: [number, number], segments: number): number[] => {
  const [min, max] = range;
  if (segments <= 1 || min === max) {
    return [min, max];
  }
  const step = (max - min) / segments;
  const points = Array.from({ length: segments + 1 }, (_, index) => (
    Math.round(min + step * index)
  ));
  points[0] = min;
  points[points.length - 1] = max;
  return points;
};

const normalizeBreakpoints = (
  range: [number, number],
  segments: number,
  breakpoints?: number[],
): number[] => {
  const safeSegments = Math.min(Math.max(segments, SHARED_ZOOM_SEGMENT_MIN), SHARED_ZOOM_SEGMENT_MAX);
  const clampedRange = clampRange(range);
  const expectedLength = safeSegments + 1;
  if (!Array.isArray(breakpoints) || breakpoints.length !== expectedLength) {
    return distributeBreakpoints(clampedRange, safeSegments);
  }
  const sorted = [...breakpoints]
    .map((value) => Math.min(Math.max(Number(value), clampedRange[0]), clampedRange[1]))
    .sort((a, b) => a - b);
  sorted[0] = clampedRange[0];
  sorted[sorted.length - 1] = clampedRange[1];
  return sorted;
};

const normalizeSharedZoomConfig = (value: unknown): SharedZoomConfig => {
  if (Array.isArray(value)) {
    const range = clampRange([
      Number.isFinite(Number(value[0])) ? Number(value[0]) : DEFAULT_SHARED_ZOOM_RANGE[0],
      Number.isFinite(Number(value[1])) ? Number(value[1]) : DEFAULT_SHARED_ZOOM_RANGE[1],
    ]);
    const breakpoints = normalizeBreakpoints(range, DEFAULT_SHARED_ZOOM_SEGMENTS);
    return { range, segments: DEFAULT_SHARED_ZOOM_SEGMENTS, breakpoints };
  }
  if (value && typeof value === 'object') {
    const record = value as Partial<SharedZoomConfig>;
    const range = clampRange([
      Number.isFinite(Number(record.range?.[0])) ? Number(record.range?.[0]) : DEFAULT_SHARED_ZOOM_RANGE[0],
      Number.isFinite(Number(record.range?.[1])) ? Number(record.range?.[1]) : DEFAULT_SHARED_ZOOM_RANGE[1],
    ]);
    const segments = Number.isFinite(Number(record.segments))
      ? Number(record.segments)
      : DEFAULT_SHARED_ZOOM_SEGMENTS;
    const breakpoints = normalizeBreakpoints(range, segments, record.breakpoints);
    return {
      range,
      segments: Math.min(Math.max(segments, SHARED_ZOOM_SEGMENT_MIN), SHARED_ZOOM_SEGMENT_MAX),
      breakpoints,
    };
  }
  return {
    range: DEFAULT_SHARED_ZOOM_RANGE,
    segments: DEFAULT_SHARED_ZOOM_SEGMENTS,
    breakpoints: DEFAULT_SHARED_ZOOM_BREAKPOINTS,
  };
};

const readSharedZoomConfig = (): SharedZoomConfig => {
  if (typeof window === 'undefined') {
    return normalizeSharedZoomConfig(null);
  }
  const stored = window.localStorage?.getItem(SHARED_ZOOM_RANGE_KEY);
  if (!stored) {
    return normalizeSharedZoomConfig(null);
  }
  try {
    const parsed = JSON.parse(stored);
    return normalizeSharedZoomConfig(parsed);
  } catch (error) {
    console.warn('[TreeConsoleToolbar] Failed to parse shared zoom range', error);
    return normalizeSharedZoomConfig(null);
  }
};

const persistSharedZoomConfig = (config: SharedZoomConfig): void => {
  if (typeof window === 'undefined') return;
  window.localStorage?.setItem(SHARED_ZOOM_RANGE_KEY, JSON.stringify(config));
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
    sharedZoomRangeLabel: string;
    sharedZoomSegmentsLabel: string;
    sharedZoomSegmentsHelper: string;
    sharedZoomBreakpointsLabel: string;
    sharedZoomBreakpointsHelper: string;
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
  const [sharedZoomConfig, setSharedZoomConfig] = useState<SharedZoomConfig>(() => readSharedZoomConfig());

  const settingsOpen = Boolean(settingsAnchorEl);

  useEffect(() => {
    persistSharedZoomConfig(sharedZoomConfig);
  }, [sharedZoomConfig]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== SHARED_ZOOM_RANGE_KEY) return;
      setSharedZoomConfig(readSharedZoomConfig());
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
    const [minZoom, maxZoom] = sharedZoomConfig.range;
    return `${minZoom} - ${maxZoom}`;
  }, [sharedZoomConfig.range]);

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
            <Typography variant="body2" gutterBottom>
              {labels.sharedZoomRangeLabel}
            </Typography>
            <Box sx={{ px: 1 }}>
              <Slider
                value={sharedZoomConfig.range}
                onChange={(_, value) => {
                  if (!Array.isArray(value)) return;
                  const [minZoom, maxZoom] = value;
                  const nextRange = clampRange([minZoom, maxZoom]);
                  const nextConfig = {
                    range: nextRange,
                    segments: sharedZoomConfig.segments,
                    breakpoints: normalizeBreakpoints(
                      nextRange,
                      sharedZoomConfig.segments,
                      sharedZoomConfig.breakpoints,
                    ),
                  };
                  setSharedZoomConfig(nextConfig);
                }}
                min={SHARED_ZOOM_RANGE_MIN}
                max={SHARED_ZOOM_RANGE_MAX}
                step={1}
                marks={[
                  { value: 0, label: '0' },
                  { value: 4, label: '4' },
                  { value: 8, label: '8' },
                  { value: 12, label: '12' },
                ]}
                valueLabelDisplay="auto"
              />
            </Box>
            <Typography variant="caption" color="text.secondary">
              {sharedZoomLabel}
            </Typography>

            <Divider sx={{ my: 1.5 }} />

            <Typography variant="body2" gutterBottom>
              {labels.sharedZoomSegmentsLabel}
            </Typography>
            <Box sx={{ px: 1 }}>
              <Slider
                value={sharedZoomConfig.segments}
                onChange={(_, value) => {
                  const nextSegments = Math.min(
                    Math.max(Number(value), SHARED_ZOOM_SEGMENT_MIN),
                    SHARED_ZOOM_SEGMENT_MAX,
                  );
                  const nextConfig = {
                    range: sharedZoomConfig.range,
                    segments: nextSegments,
                    breakpoints: normalizeBreakpoints(sharedZoomConfig.range, nextSegments),
                  };
                  setSharedZoomConfig(nextConfig);
                }}
                min={SHARED_ZOOM_SEGMENT_MIN}
                max={SHARED_ZOOM_SEGMENT_MAX}
                step={1}
                marks
                valueLabelDisplay="auto"
              />
            </Box>
            <Typography variant="caption" color="text.secondary">
              {labels.sharedZoomSegmentsHelper}
            </Typography>

            <Divider sx={{ my: 1.5 }} />

            <Typography variant="body2" gutterBottom>
              {labels.sharedZoomBreakpointsLabel}
            </Typography>
            <Box sx={{ px: 1 }}>
              <Slider
                value={sharedZoomConfig.breakpoints}
                onChange={(_, value) => {
                  const values = Array.isArray(value) ? value : [Number(value)];
                  const nextConfig = {
                    range: sharedZoomConfig.range,
                    segments: sharedZoomConfig.segments,
                    breakpoints: normalizeBreakpoints(
                      sharedZoomConfig.range,
                      sharedZoomConfig.segments,
                      values,
                    ),
                  };
                  setSharedZoomConfig(nextConfig);
                }}
                min={SHARED_ZOOM_RANGE_MIN}
                max={SHARED_ZOOM_RANGE_MAX}
                step={1}
                marks={[
                  { value: 0, label: '0' },
                  { value: 4, label: '4' },
                  { value: 8, label: '8' },
                  { value: 12, label: '12' },
                ]}
                valueLabelDisplay="auto"
              />
            </Box>
            <Typography variant="caption" color="text.secondary">
              {labels.sharedZoomBreakpointsHelper}
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
