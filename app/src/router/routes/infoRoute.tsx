/**
 * info Route for TanStack Router
 *
 * Displays application information and licenses
 */

import { createRoute } from '@tanstack/react-router';
import { InfoPage } from '~/router/pages/info/InfoPage';
import { loadAppConfig } from '~/loadAppConfig';
import { rootRoute } from './rootRoute.js';

interface InfoLoaderResult {
  appConfig: ReturnType<typeof loadAppConfig>;
}

export const infoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/info',
  loader: (): InfoLoaderResult => {
    const appConfig = loadAppConfig();
    return { appConfig };
  },
  component: function InfoRouteComponent() {
    const { appConfig } = infoRoute.useLoaderData();
    return <InfoPage appConfig={appConfig} />;
  },
});
