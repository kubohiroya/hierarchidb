import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { FormControl, InputLabel, MenuItem, Select, type SelectChangeEvent } from '@mui/material';

type Manifest = {
  languages: Array<{ code: string; name?: string; nativeName?: string; direction?: 'ltr' | 'rtl' }>
};

const readCurrent = (): string => {
  if (typeof window === 'undefined') return 'en';
  const ls = window.localStorage.getItem('preferred-language') || window.localStorage.getItem('i18nextLng');
  if (ls && ls.length > 0) return ls.split('-')[0] as string;
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'en';
  return ((nav || 'en').split('-')[0]) as string;
};

export const LanguageSelector: React.FC<{ size?: 'small' | 'medium' }> = ({ size = 'small' }) => {
  const [langs, setLangs] = useState<Manifest['languages']>([]);
  const [value, setValue] = useState<string>(readCurrent());

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const base = (import.meta.env?.BASE_URL ?? '/').replace(/\/+$/, '/');
        const res = await fetch(`${base}locales/manifest.json`).catch(() => null);
        if (active && res && res.ok) {
          const data = (await res.json()) as Manifest;
          const detected = (data.languages || []);
          if (detected.length > 0) setLangs(detected);
        }
      } catch {
        // ignore
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const options = useMemo(() => (
    langs.length > 0
      ? langs
      : [{ code: 'en', name: 'English', nativeName: 'English', direction: 'ltr' as const }]
  ), [langs]);

  // If current value is not in options yet (e.g., 'ja' before manifest loads),
  // normalize it to the first available option to avoid MUI out-of-range warnings.
  const normalizedValue = useMemo(() => {
    if (options.some(o => o.code === value)) return value;
    return options[0]?.code ?? '';
  }, [options, value]);

  // Keep local state and persisted storage consistent when normalization occurs
  useEffect(() => {
    if (normalizedValue !== value) {
      setValue(normalizedValue);
      localStorage.setItem('preferred-language', normalizedValue);
      localStorage.setItem('i18nextLng', normalizedValue);
      if (typeof document !== 'undefined') document.documentElement.lang = normalizedValue;
    }
  }, [normalizedValue, value]);

  const labelFor = (entry: { code: string; name?: string; nativeName?: string }) => {
    const display = entry.nativeName || entry.name || entry.code.toUpperCase();
    return `${display} (${entry.code.toUpperCase()})`;
  };

  const onChange = (e: SelectChangeEvent<string>) => {
    const next = e.target?.value ?? '';
    setValue(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('preferred-language', next);
      localStorage.setItem('i18nextLng', next);
      if (typeof document !== 'undefined') {
        document.documentElement.lang = next;
      }
      // Try update without reload if i18next is available
      // Attempt lazy i18n change without hard dependency
      const languageWindow = window as LanguageWindow;
      if (languageWindow.i18next?.changeLanguage) {
        languageWindow.i18next.changeLanguage(next);
      } else {
        window.location.reload();
      }
    }
  };

  return (
    <FormControl size={size} sx={{ minWidth: 120 }}>
      <InputLabel id="lang-select-label">Lang</InputLabel>
      <Select labelId="lang-select-label" label="Lang" value={normalizedValue} onChange={onChange}>
        {options.map((entry) => (
          <MenuItem key={entry.code} value={entry.code}>{labelFor(entry)}</MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};
type LanguageWindow = Window & {
  i18next?: {
    changeLanguage?: (lang: string) => unknown;
  };
};
