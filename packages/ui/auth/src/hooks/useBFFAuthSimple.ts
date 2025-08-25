/**
 * @file useBFFAuthSimple.ts
 * @description Simplified BFF authentication hook without complex dependencies
 */

import { useState, useCallback } from 'react';

export interface SimpleUser {
  profile: {
    email: string;
    name: string;
    picture?: string;
    preferred_username?: string;
  };
}

export interface SimpleAuth {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: SimpleUser | null;
}

/**
 * Simplified BFF Authentication Hook
 * This version avoids all the complex dependencies and just redirects to OAuth
 */
export function useBFFAuth() {
  console.error('🟢🟢🟢 [useBFFAuthSimple] SIMPLE VERSION LOADED - No more POST to /api/auth/signin');
  
  const [isLoading] = useState(false);
  const [user] = useState<SimpleUser | null>(null);

  const signIn = useCallback(async (options?: any) => {
    console.error('🟢🟢🟢 [useBFFAuthSimple.signIn] Redirecting to OAuth');
    const provider = options?.provider || 'google';
    
    // Simple redirect to OAuth - no POST request
    window.location.href = `/api/auth/${provider}/authorize`;
  }, []);

  const signOut = useCallback(async () => {
    console.error('🟢🟢🟢 [useBFFAuthSimple.signOut] Signing out');
    localStorage.clear();
    window.location.href = '/';
  }, []);

  const auth: SimpleAuth = {
    isAuthenticated: false,
    isLoading,
    user,
  };

  return {
    user,
    isAuthenticated: false,
    isLoading,
    signIn,
    signOut,
    getIdToken: () => undefined,
    getAccessToken: () => undefined,
    currentProvider: 'google' as const,
    auth,
    resumeAfterSignIn: () => {},
    refreshToken: async () => null,
    isRefreshing: false,
    tokenExpiresAt: undefined,
  };
}

export function getIdToken(): string | undefined {
  return localStorage.getItem('access_token') || undefined;
}