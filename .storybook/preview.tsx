import CssBaseline from '@mui/material/CssBaseline';
// import { Add } from '@mui/icon-material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import type { Preview } from '@storybook/react-vite';

// MUIテーマの設定
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
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Story />
      </ThemeProvider>
    ),
  ],
};

export default preview;
