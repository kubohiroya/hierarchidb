import React, { useEffect, useMemo, useState } from 'react';
import { FormControl, InputLabel, MenuItem, Select, SelectChangeEvent } from '@mui/material';

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
        const base = (import.meta as any)?.env?.BASE_URL || '/';
        const res = await fetch(`${String(base).replace(/\/+$/, '/')}locales/manifest.json`).catch(() => null);
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

  const labelFor = (entry: { code: string; name?: string; nativeName?: string }) => {
    const display = entry.nativeName || entry.name || entry.code.toUpperCase();
    return `${display} (${entry.code.toUpperCase()})`;
  };

  const onChange = (e: SelectChangeEvent<string>) => {
    const next = (e.target?.value ?? '') as string;
    setValue(next);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('preferred-language', next);
        localStorage.setItem('i18nextLng', next);
        if (typeof document !== 'undefined') {
          document.documentElement.lang = next;
        }
        // Try update without reload if i18next is available
        // Attempt lazy i18n change without hard dependency
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const anyWindow = window as any;
          if (anyWindow?.i18next?.changeLanguage) {
            anyWindow.i18next.changeLanguage(next);
          } else {
            window.location.reload();
          }
        } catch {
          window.location.reload();
        }
      }
    } catch {
      // ignore
    }
  };

  return (
    <FormControl size={size} sx={{ minWidth: 120 }}>
      <InputLabel id="lang-select-label">Lang</InputLabel>
      <Select labelId="lang-select-label" label="Lang" value={value} onChange={onChange}>
        {options.map((entry) => (
          <MenuItem key={entry.code} value={entry.code}>{labelFor(entry)}</MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default LanguageSelector;
