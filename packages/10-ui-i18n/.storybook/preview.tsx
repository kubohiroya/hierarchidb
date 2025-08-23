import type { Preview } from '@storybook/react';
import React, { Suspense } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// Initialize i18n for Storybook
i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  debug: true,
  resources: {
    en: {
      translation: {
        welcome: 'Welcome',
        hello: 'Hello {{name}}',
        loading: 'Loading...',
        language: 'Language',
        settings: 'Settings',
        profile: 'Profile',
      },
    },
    ja: {
      translation: {
        welcome: 'ようこそ',
        hello: 'こんにちは {{name}}',
        loading: '読み込み中...',
        language: '言語',
        settings: '設定',
        profile: 'プロファイル',
      },
    },
  },
  interpolation: {
    escapeValue: false,
  },
});

const theme = createTheme({
  palette: {
    mode: 'light',
  },
});

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  decorators: [
    (Story) => (
      <I18nextProvider i18n={i18n}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <Suspense fallback="Loading...">
            <Story />
          </Suspense>
        </ThemeProvider>
      </I18nextProvider>
    ),
  ],
};

export default preview;
