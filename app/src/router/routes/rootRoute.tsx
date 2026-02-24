/**
 * Root Route for TanStack Router
 *
 * This is the root of the route console. It sets up:
 * - UI plugin initialization via beforeLoad
 * - Common context available to all child routes
 * - App providers wrapper
 */

import { createRootRoute, Outlet } from '@tanstack/react-router';
import { setupUIPlugins } from '~/router/loaders/uiPlugins';
import { AuthRequiredDialog } from '@hierarchidb/ui-plugin-shell/ui-auth';
import { useAuthRequiredDialogHost } from '~/contexts/useAuthRequiredDialogHost';

const AuthRequiredDialogHost = () => {
  const { notification, handleSuccess, handleCancel } = useAuthRequiredDialogHost();

  if (!notification) {
    return null;
  }

  return (
    <AuthRequiredDialog
      open
      notification={notification}
      onSuccess={handleSuccess}
      onCancel={handleCancel}
      cancelLabel="Cancel"
    />
  );
};

interface RootContext {
  uiPluginsReady: boolean;
}

export const rootRoute = createRootRoute({
  beforeLoad: async (): Promise<RootContext> => {
    // Setup UI plugin-loaders before any routes load
    await setupUIPlugins();

    return {
      uiPluginsReady: true,
    };
  },
  component: () => (
    <>
      <AuthRequiredDialogHost />
      <Outlet />
    </>
  ),
});
