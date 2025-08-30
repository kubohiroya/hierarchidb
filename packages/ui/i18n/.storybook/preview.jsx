"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = require("react");
var react_i18next_1 = require("react-i18next");
var i18next_1 = require("i18next");
var react_i18next_2 = require("react-i18next");
var styles_1 = require("@mui/material/styles");
var CssBaseline_1 = require("@mui/material/CssBaseline");
// Initialize i18n for Storybook
i18next_1.default.use(react_i18next_2.initReactI18next).init({
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
var theme = (0, styles_1.createTheme)({
    palette: {
        mode: 'light',
    },
});
var preview = {
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
        function (Story) { return (<react_i18next_1.I18nextProvider i18n={i18next_1.default}>
        <styles_1.ThemeProvider theme={theme}>
          <CssBaseline_1.default />
          <react_1.Suspense fallback="Loading...">
            <Story />
          </react_1.Suspense>
        </styles_1.ThemeProvider>
      </react_i18next_1.I18nextProvider>); },
    ],
};
exports.default = preview;
