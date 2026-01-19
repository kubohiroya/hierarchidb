/**
 * Auth Routes for TanStack Router
 *
 * Handles authentication flows:
 * - /auth/login - Login page
 * - /auth/callback - OAuth callback handler
 * - /auth/silent-renew - Silent token renewal
 */

import { createRoute } from '@tanstack/react-router';
import { rootRoute } from '../rootRoute.js';
import CallbackRoute from './auth.callback.js';
// Import existing auth components from React Router routes
import LoginRoute from './auth.login.js';
import SilentRenewRoute from './auth.silent-renew.js';

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
