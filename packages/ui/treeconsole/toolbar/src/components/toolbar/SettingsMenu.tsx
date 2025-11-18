import {
  CheckBox,
  DarkMode as DarkModeIcon,
  DeleteSweep as DeleteSweepIcon,
  Edit,
  LightMode as LightModeIcon,
  Settings as SettingsIcon,
  SettingsBrightness as SystemThemeIcon,
  Translate as TranslateIcon,
} from '@mui/icons-material';
import {
  Divider,
  FormControlLabel,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Typography,
} from '@mui/material';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import type { TreeConsoleToolbarActionParams } from '../../types.js';

interface SettingsMenuProps {
  rowClickAction: 'Select/Navigate' | 'Edit';
  onRowClickActionChange?: (action: 'Select/Navigate' | 'Edit') => void;
  onAction: (action: string, params?: TreeConsoleToolbarActionParams) => void;
  developerModeEnabled: boolean;
  portalContainer?: HTMLElement;
  labels: {
    settingsButton: string;
    rowClickTitle: string;
    rowClickSelectNavigate: string;
    rowClickEdit: string;
    themeTitle: string;
    themeModes: { system: string; light: string; dark: string };
    languageTitle: string;
    languageModes: { system: string; en: string; ja: string };
    developerMenuLabel: string;
  };
}

export function SettingsMenu({
  rowClickAction,
  onRowClickActionChange,
  onAction,
  developerModeEnabled,
  portalContainer,
  labels,
}: SettingsMenuProps) {
  const [settingsAnchorEl, setSettingsAnchorEl] = useState<HTMLElement | null>(null);
  const [themeAnchorEl, setThemeAnchorEl] = useState<HTMLElement | null>(null);
  const [languageAnchorEl, setLanguageAnchorEl] = useState<HTMLElement | null>(null);
  const [themeMode, setThemeMode] = useState<'system' | 'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'system';
    const stored = localStorage.getItem('app.theme');
    return (stored as 'system' | 'light' | 'dark') ?? 'system';
  });
  const [language, setLanguage] = useState<string>(() => {
    if (typeof window === 'undefined') return 'system';
    return localStorage.getItem('app.lang') ?? 'system';
  });

  const settingsOpen = Boolean(settingsAnchorEl);
  const themeOpen = Boolean(themeAnchorEl);
  const languageOpen = Boolean(languageAnchorEl);

  const scheduleCloseSettingsMenu = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        setSettingsAnchorEl(null);
        setThemeAnchorEl(null);
        setLanguageAnchorEl(null);
      }, 0);
    } else {
      setSettingsAnchorEl(null);
      setThemeAnchorEl(null);
      setLanguageAnchorEl(null);
    }
  }, []);

  const handleSettingsClick = (event: React.MouseEvent<HTMLElement>) => {
    setSettingsAnchorEl(event.currentTarget);
    setThemeAnchorEl(null);
    setLanguageAnchorEl(null);
  };

  const handleRowClickChange = (value: 'Select/Navigate' | 'Edit') => {
    if (onRowClickActionChange) {
      onRowClickActionChange(value);
    } else {
      onAction('setRowClickAction', value);
    }
    scheduleCloseSettingsMenu();
  };

  const openThemeMenu = (event: React.MouseEvent<HTMLElement>) => {
    setLanguageAnchorEl(null);
    setThemeAnchorEl(event.currentTarget);
  };
  const closeThemeMenu = () => setThemeAnchorEl(null);
  const selectTheme = (mode: 'system' | 'light' | 'dark') => {
    setThemeMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('app.theme', mode);
      window.dispatchEvent(new CustomEvent('hierarchidb-theme-change', { detail: { mode } }));
    }
    closeThemeMenu();
    scheduleCloseSettingsMenu();
  };

  const openLanguageMenu = (event: React.MouseEvent<HTMLElement>) => {
    setThemeAnchorEl(null);
    setLanguageAnchorEl(event.currentTarget);
  };
  const closeLanguageMenu = () => setLanguageAnchorEl(null);
  const selectLanguage = (lang: string) => {
    setLanguage(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('app.lang', lang);
      window.dispatchEvent(new CustomEvent('hierarchidb-language-change', { detail: { lang } }));
    }
    closeLanguageMenu();
    scheduleCloseSettingsMenu();
  };

  const themeIcon = useMemo(() => {
    if (themeMode === 'dark') return <DarkModeIcon fontSize="small" />;
    if (themeMode === 'light') return <LightModeIcon fontSize="small" />;
    return <SystemThemeIcon fontSize="small" />;
  }, [themeMode]);

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
          </Paper>
        </MenuItem>

        <Divider sx={{ my: 1 }} />

        <MenuItem onClick={openThemeMenu} aria-haspopup="menu" aria-label={labels.themeTitle}>
          <ListItemIcon>{themeIcon}</ListItemIcon>
          <ListItemText
            primary={labels.themeTitle}
            secondary={labels.themeModes[themeMode] ?? themeMode}
          />
        </MenuItem>

        <MenuItem onClick={openLanguageMenu} aria-haspopup="menu" aria-label={labels.languageTitle}>
          <ListItemIcon>
            <TranslateIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary={labels.languageTitle}
            secondary={labels.languageModes[language as keyof typeof labels.languageModes] ?? language}
          />
        </MenuItem>

        {developerModeEnabled && [
          <Divider key="dev-divider" sx={{ my: 1 }} />,
          <MenuItem
            key="dev-clear-indexeddb"
            onClick={() => {
              onAction('clear-indexeddb');
              setSettingsAnchorEl(null);
            }}
            aria-label={labels.developerMenuLabel}
          >
            <ListItemIcon>
              <DeleteSweepIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={labels.developerMenuLabel} />
          </MenuItem>,
        ]}
      </Menu>

      <Menu anchorEl={themeAnchorEl} open={themeOpen} onClose={closeThemeMenu} container={portalContainer}>
        <MenuItem
          selected={themeMode === 'system'}
          onClick={() => selectTheme('system')}
          aria-label={labels.themeModes.system}
        >
          <ListItemIcon>
            <SystemThemeIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={labels.themeModes.system} />
        </MenuItem>
        <MenuItem
          selected={themeMode === 'light'}
          onClick={() => selectTheme('light')}
          aria-label={labels.themeModes.light}
        >
          <ListItemIcon>
            <LightModeIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={labels.themeModes.light} />
        </MenuItem>
        <MenuItem
          selected={themeMode === 'dark'}
          onClick={() => selectTheme('dark')}
          aria-label={labels.themeModes.dark}
        >
          <ListItemIcon>
            <DarkModeIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={labels.themeModes.dark} />
        </MenuItem>
      </Menu>

      <Menu anchorEl={languageAnchorEl} open={languageOpen} onClose={closeLanguageMenu} container={portalContainer}>
        <MenuItem
          selected={language === 'system'}
          onClick={() => selectLanguage('system')}
          aria-label={labels.languageModes.system}
        >
          <ListItemText primary={labels.languageModes.system} />
        </MenuItem>
        <MenuItem
          selected={language === 'en'}
          onClick={() => selectLanguage('en')}
          aria-label={labels.languageModes.en}
        >
          <ListItemText primary={labels.languageModes.en} />
        </MenuItem>
        <MenuItem
          selected={language === 'ja'}
          onClick={() => selectLanguage('ja')}
          aria-label={labels.languageModes.ja}
        >
          <ListItemText primary={labels.languageModes.ja} />
        </MenuItem>
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
