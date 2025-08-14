/**
 * End-to-end tests for BFF service deployed on Cloudflare
 * Run these tests against your deployed service
 */

import { describe, it, expect, beforeAll } from 'vitest';

// Production/staging URLs - set via environment variables
const DEPLOYED_BFF_URL = process.env.DEPLOYED_BFF_URL;
const DEPLOYED_FRONTEND_URL = process.env.DEPLOYED_FRONTEND_URL || 'https://your-app.com';

// Skip E2E tests if no deployed URL is provided
const skipE2E = !DEPLOYED_BFF_URL;

describe.skipIf(skipE2E)('BFF E2E Tests (Deployed)', () => {
  beforeAll(() => {
    if (!DEPLOYED_BFF_URL) {
      console.log('Skipping E2E tests - DEPLOYED_BFF_URL not set');
      console.log('To run E2E tests: DEPLOYED_BFF_URL=https://your-bff.workers.dev npm test');
    }
  });

  describe('Service Availability', () => {
    it('should be accessible', async () => {
      const response = await fetch(`${DEPLOYED_BFF_URL}/`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.service).toBe('hierarchidb BFF');
      expect(data.status).toBe('healthy');
    });

    it('should have proper CORS configuration', async () => {
      const response = await fetch(`${DEPLOYED_BFF_URL}/`, {
        headers: {
          Origin: DEPLOYED_FRONTEND_URL,
        },
      });

      const allowedOrigin = response.headers.get('Access-Control-Allow-Origin');
      expect(allowedOrigin).toBeTruthy();
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    });
  });

  describe('OAuth2 Endpoints', () => {
    it('should have Google OAuth2 configured', async () => {
      const response = await fetch(`${DEPLOYED_BFF_URL}/auth/google/authorize`, {
        redirect: 'manual',
      });

      expect(response.status).toBe(302);
      const location = response.headers.get('location');
      expect(location).toContain('accounts.google.com');
    });

    it('should support PKCE flow', async () => {
      const response = await fetch(
        `${DEPLOYED_BFF_URL}/auth/google/authorize?` +
          'code_challenge=test123&code_challenge_method=S256',
        {
          redirect: 'manual',
        }
      );

      expect(response.status).toBe(302);
      const location = response.headers.get('location');
      expect(location).toContain('code_challenge=test123');
    });
  });

  describe('OpenID Discovery', () => {
    it('should provide discovery endpoint', async () => {
      const response = await fetch(`${DEPLOYED_BFF_URL}/.well-known/openid-configuration`);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.issuer).toBe(DEPLOYED_BFF_URL);
      expect(data.authorization_endpoint).toBe(`${DEPLOYED_BFF_URL}/auth/authorize`);
      expect(data.token_endpoint).toBe(`${DEPLOYED_BFF_URL}/auth/token`);
      expect(data.userinfo_endpoint).toBe(`${DEPLOYED_BFF_URL}/auth/userinfo`);

      // Check authorization endpoints for each provider
      expect(data.authorization_endpoints).toEqual({
        google: `${DEPLOYED_BFF_URL}/auth/google/authorize`,
        github: `${DEPLOYED_BFF_URL}/auth/github/authorize`,
        microsoft: `${DEPLOYED_BFF_URL}/auth/microsoft/authorize`,
      });
    });
  });

  describe('Security Headers', () => {
    it('should not expose sensitive information', async () => {
      const response = await fetch(`${DEPLOYED_BFF_URL}/`);

      // Should not expose server information
      expect(response.headers.get('server')).toBeNull();
      expect(response.headers.get('x-powered-by')).toBeNull();
    });

    it('should handle invalid requests gracefully', async () => {
      const response = await fetch(`${DEPLOYED_BFF_URL}/auth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: '<script>alert("xss")</script>',
          provider: 'google',
        }),
      });

      expect(response.status).toBeGreaterThanOrEqual(400);
      const text = await response.text();
      // Should not reflect the script tag
      expect(text).not.toContain('<script>');
    });
  });

  describe('Rate Limiting', () => {
    it('should handle multiple requests', async () => {
      // Make multiple requests to check if rate limiting is in place
      const requests = Array(5)
        .fill(null)
        .map(() => fetch(`${DEPLOYED_BFF_URL}/`));

      const responses = await Promise.all(requests);

      // All should succeed (no rate limiting on health check)
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });
    });
  });
});
