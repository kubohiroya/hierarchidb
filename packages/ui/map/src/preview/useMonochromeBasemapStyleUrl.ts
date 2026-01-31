import { useTheme } from '@mui/material/styles';

const MONOCHROME_STYLE_URLS = {
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
};

export const useMonochromeBasemapStyleUrl = (): string => {
  const theme = useTheme();
  return theme.palette.mode === 'dark'
    ? MONOCHROME_STYLE_URLS.dark
    : MONOCHROME_STYLE_URLS.light;
};
