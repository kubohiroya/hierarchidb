/**
 * OAuth2/OIDC security helpers used across the authentication UI.
 */

import { AUTH_CONSTANTS } from './AuthServiceConfig.js';

type AuthParams = Record<string, string>;

const base64UrlEncode = (buffer: Uint8Array): string => {
  const base64 = btoa(String.fromCharCode(...buffer));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};

const getRandomBytes = (length: number): Uint8Array => {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return array;
};

const generateState = (): string => base64UrlEncode(getRandomBytes(32));

const generateNonce = (): string => base64UrlEncode(getRandomBytes(32));

const generateCodeVerifier = (): string =>
  base64UrlEncode(getRandomBytes(AUTH_CONSTANTS.CODE_VERIFIER_LENGTH / 2));

const generateCodeChallenge = async (verifier: string): Promise<string> => {
  if (!verifier) {
    throw new Error('Code verifierが必要です');
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(hashBuffer));
};

const isValidMessageOrigin = (eventOrigin: string, expectedOrigin: string): boolean => {
  if (!eventOrigin || !expectedOrigin) {
    return false;
  }

  return eventOrigin === expectedOrigin;
};

const generateSecureRandomString = (length: number = 32): string => {
  const bytes = getRandomBytes(length);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const isValidTimestamp = (timestamp: number, toleranceSeconds: number = 300): boolean => {
  const diff = Math.abs(Date.now() - timestamp);
  return diff <= toleranceSeconds * 1000;
};

const validateScopes = (requestedScopes: string, allowedScopes: string[]): boolean => {
  const requested = requestedScopes.split(' ').filter((scope) => scope.length > 0);
  return requested.every((scope) => allowedScopes.includes(scope));
};

const buildSecureUrl = (baseUrl: string, params: AuthParams): string => {
  const url = new URL(baseUrl);
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, value);
    }
  });

  url.search = searchParams.toString();
  return url.toString();
};

export const AuthSecurityUtils = {
  generateState,
  generateNonce,
  generateCodeVerifier,
  generateCodeChallenge,
  isValidMessageOrigin,
  generateSecureRandomString,
  isValidTimestamp,
  validateScopes,
  buildSecureUrl,
};

export type AuthSecurityUtilsType = typeof AuthSecurityUtils;
