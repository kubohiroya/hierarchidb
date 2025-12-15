import {
  CheckBox,
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
  Switch,
  Typography,
} from '@mui/material';
import { useCallback, useState, type ReactNode } from 'react';
import type { TreeConsoleToolbarActionParams } from '../../types.js';

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

  const settingsOpen = Boolean(settingsAnchorEl);

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
