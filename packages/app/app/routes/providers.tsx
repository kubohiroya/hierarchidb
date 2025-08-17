import { Outlet } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { theme } from '~/theme';
import { useEffect, useState, useMemo } from 'react';

// Emotionキャッシュを一度だけ作成
const emotionCache = createCache({
  key: 'mui',
  prepend: true,
});

export default function Providers() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <CacheProvider value={emotionCache}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Outlet />
      </ThemeProvider>
    </CacheProvider>
  );
}