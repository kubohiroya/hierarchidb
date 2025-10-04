/**
 * Auth Routes for TanStack Router
 * 
 * Handles authentication flows:
 * - /auth/login - Login page
 * - /auth/callback - OAuth callback handler
 * - /auth/silent-renew - Silent token renewal
 */

import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './rootRoute.js';

// Import existing auth components from React Router routes
import LoginRoute from '../../routes/auth.login.js';
import CallbackRoute from '../../routes/auth.callback.js';
import SilentRenewRoute from '../../routes/auth.silent-renew.js';

export const authLoginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/login',
  component: LoginRoute,
});

export const authCallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/callback',
  component: CallbackRoute,
});

export const authSilentRenewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/silent-renew',
  component: SilentRenewRoute,
});
