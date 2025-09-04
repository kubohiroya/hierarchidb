import React, { useEffect, useMemo, useState } from 'react';
import { FormControl, InputLabel, MenuItem, Select, SelectChangeEvent } from '@mui/material';

type Manifest = {
  languages: Array<{ code: string; name?: string; nativeName?: string; direction?: 'ltr'|'rtl' }>
};

const readCurrent = (): string => {
  if (typeof window === 'undefined') return 'en';
  const ls = window.localStorage.getItem('preferred-language') || window.localStorage.getItem('i18nextLng');
  if (ls && ls.length > 0) return ls.split('-')[0] as string;
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'en';
  return ((nav || 'en').split('-')[0]) as string;
};

export const LanguageSelector: React.FC<{ size?: 'small'|'medium' }> = ({ size = 'small' }) => {
  const [langs, setLangs] = useState<string[]>([]);
  const [value, setValue] = useState<string>(readCurrent());

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const base = (import.meta as any)?.env?.BASE_URL || '/';
        const res = await fetch(`${String(base).replace(/\/+$/, '/') }locales/manifest.json`).catch(() => null);
        if (active && res && res.ok) {
          const data = (await res.json()) as Manifest;
          const detected = (data.languages || []).map(l => l.code);
          if (detected.length > 0) setLangs(detected);
        }
      } catch {
        // ignore
      }
    };
    load();
    return () => { active = false; };
  }, []);

  const options = useMemo(() => (langs.length > 0 ? langs : ['en']), [langs]);

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
        // soft reload to ensure i18n runtime applies; in future, wire to i18n.changeLanguage
        window.location.reload();
      }
    } catch {
      // ignore
    }
  };

  return (
    <FormControl size={size} sx={{ minWidth: 120 }}>
      <InputLabel id="lang-select-label">Lang</InputLabel>
      <Select labelId="lang-select-label" label="Lang" value={value} onChange={onChange}>
        {options.map((code) => (
          <MenuItem key={code} value={code}>{code.toUpperCase()}</MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default LanguageSelector;
