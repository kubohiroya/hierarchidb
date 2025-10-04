import type { Preview } from '@storybook/provider';
import React from 'react';
import {
  RouterProvider,
  Outlet,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

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
      (() => {
        const history = createMemoryHistory({ initialEntries: ['/'] });

        const rootRoute = createRootRoute({
          component: () => (
            <ThemeProvider theme={theme}>
              <CssBaseline />
              <Outlet />
            </ThemeProvider>
          ),
        });

        const storyRoute = createRoute({
          getParentRoute: () => rootRoute,
          path: '/',
          component: Story,
        });

        const routeTree = rootRoute.addChildren([storyRoute]);

        const router = createRouter({
          routeTree,
          history,
        });

        return <RouterProvider router={router as any} />;
      })()
    ),
  ],
};

export default preview;
