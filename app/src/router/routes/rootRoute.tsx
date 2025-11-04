/**
 * Root Route for TanStack Router
 *
 * This is the root of the route tree. It sets up:
 * - UI plugin initialization via beforeLoad
 * - Common context available to all child routes
 * - App providers wrapper
 */

import { createRootRoute, Outlet } from '@tanstack/react-router';
import AppRoot from '../../root.js';
import { setupUIPlugins } from '../loaders/uiPlugins.js';

interface RootContext {
  uiPluginsReady: boolean;
}

export const rootRoute = createRootRoute({
  beforeLoad: async (): Promise<RootContext> => {
    // Setup UI plugin-loader before any routes load
    await setupUIPlugins();

    return {
      uiPluginsReady: true,
    };
  },
  component: () => (
    <AppRoot>
      <Outlet />
    </AppRoot>
  ),
});
