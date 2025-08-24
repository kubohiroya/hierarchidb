/**
 * Integration tests for BFF service
 * Tests OAuth2 flows and session management
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Test configuration
const BFF_URL = process.env.BFF_TEST_URL || 'http://localhost:8787';
const TEST_TOKEN = process.env.TEST_JWT_TOKEN;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

interface TestConfig {
  bffUrl: string;
  testToken?: string;
  googleClientId?: string;
}

const config: TestConfig = {
  bffUrl: BFF_URL,
  testToken: TEST_TOKEN,
  googleClientId: GOOGLE_CLIENT_ID,
};

describe('BFF Service Integration Tests', () => {
  describe('Health Check', () => {
    it('should return service status', async () => {
      const response = await fetch(`${config.bffUrl}/`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('service', 'hierarchidb BFF');
      expect(data).toHaveProperty('status', 'healthy');
      expect(data).toHaveProperty('version');
      expect(data).toHaveProperty('timestamp');
    });
  });

  describe('CORS Headers', () => {
    it('should handle preflight OPTIONS requests', async () => {
      const response = await fetch(`${config.bffUrl}/`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3000',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type',
        },
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
      expect(response.headers.get('Access-Control-Allow-Methods')).toBeTruthy();
    });

    it('should add CORS headers to responses', async () => {
      const response = await fetch(`${config.bffUrl}/`, {
        headers: {
          Origin: 'http://localhost:3000',
        },
      });

      expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    });
  });

  describe('OAuth2 Authorization Endpoints', () => {
    describe('Google OAuth2', () => {
      it('should initiate Google OAuth2 flow', async () => {
        const response = await fetch(
          `${config.bffUrl}/auth/google/authorize?` +
            'scope=openid%20profile%20email&' +
            'state=test-state',
          {
            redirect: 'manual',
          }
        );

        expect(response.status).toBe(302);
        const location = response.headers.get('location');
        expect(location).toContain('accounts.google.com/o/oauth2/v2/auth');
        expect(location).toContain('response_type=code');
        expect(location).toContain('scope=openid%20profile%20email');
        expect(location).toContain('state=test-state');

        if (config.googleClientId) {
          expect(location).toContain(`client_id=${config.googleClientId}`);
        }
      });

      it('should support PKCE parameters', async () => {
        const codeChallenge = 'test-challenge-123';
        const response = await fetch(
          `${config.bffUrl}/auth/google/authorize?` +
            `code_challenge=${codeChallenge}&` +
            'code_challenge_method=S256',
          {
            redirect: 'manual',
          }
        );

        expect(response.status).toBe(302);
        const location = response.headers.get('location');
        expect(location).toContain(`code_challenge=${codeChallenge}`);
        expect(location).toContain('code_challenge_method=S256');
      });
    });

    describe('GitHub OAuth2', () => {
      it('should initiate GitHub OAuth2 flow', async () => {
        const response = await fetch(`${config.bffUrl}/auth/github/authorize?state=test-state`, {
          redirect: 'manual',
        });

        // May return 501 if not configured
        if (response.status === 302) {
          const location = response.headers.get('location');
          expect(location).toContain('github.com/login/oauth/authorize');
          expect(location).toContain('response_type=code');
          expect(location).toContain('state=test-state');
        } else {
          expect(response.status).toBe(501);
          const data = await response.json();
          expect(data.error).toBe('GitHub OAuth not configured');
        }
      });
    });

    describe('Microsoft OAuth2', () => {
      it('should initiate Microsoft OAuth2 flow', async () => {
        const response = await fetch(`${config.bffUrl}/auth/microsoft/authorize?state=test-state`, {
          redirect: 'manual',
        });

        // May return 501 if not configured
        if (response.status === 302) {
          const location = response.headers.get('location');
          expect(location).toContain('login.microsoftonline.com');
          expect(location).toContain('response_type=code');
          expect(location).toContain('state=test-state');
        } else {
          expect(response.status).toBe(501);
          const data = await response.json();
          expect(data.error).toBe('Microsoft OAuth not configured');
        }
      });

      it('should support PKCE for Microsoft', async () => {
        const codeChallenge = 'test-challenge-456';
        const response = await fetch(
          `${config.bffUrl}/auth/microsoft/authorize?` +
            `code_challenge=${codeChallenge}&` +
            'code_challenge_method=S256',
          {
            redirect: 'manual',
          }
        );

        if (response.status === 302) {
          const location = response.headers.get('location');
          expect(location).toContain(`code_challenge=${codeChallenge}`);
          expect(location).toContain('code_challenge_method=S256');
        }
      });
    });
  });

  describe('Token Endpoints', () => {
    it('should reject token exchange without code', async () => {
      const response = await fetch(`${config.bffUrl}/auth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: 'google',
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeTruthy();
    });

    it('should reject invalid authorization code', async () => {
      const response = await fetch(`${config.bffUrl}/auth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: 'invalid-code',
          provider: 'google',
        }),
      });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Session Management', () => {
    it('should reject requests without token', async () => {
      const response = await fetch(`${config.bffUrl}/auth/verify`, {
        method: 'POST',
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Missing authorization token');
    });

    it('should reject invalid tokens', async () => {
      const response = await fetch(`${config.bffUrl}/auth/verify`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer invalid-token',
        },
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Invalid token');
    });

    if (config.testToken) {
      it('should verify valid token', async () => {
        const response = await fetch(`${config.bffUrl}/auth/verify`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.testToken}`,
          },
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.valid).toBe(true);
        expect(data.user).toBeDefined();
      });

      it('should get user info with valid token', async () => {
        const response = await fetch(`${config.bffUrl}/auth/userinfo`, {
          headers: {
            Authorization: `Bearer ${config.testToken}`,
          },
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('email');
        expect(data).toHaveProperty('provider');
      });
    }
  });

  describe('OpenID Connect Discovery', () => {
    it('should provide OpenID configuration', async () => {
      const response = await fetch(`${config.bffUrl}/.well-known/openid-configuration`);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toHaveProperty('issuer');
      expect(data).toHaveProperty('authorization_endpoint');
      expect(data).toHaveProperty('token_endpoint');
      expect(data).toHaveProperty('userinfo_endpoint');
      expect(data).toHaveProperty('jwks_uri');
      expect(data.response_types_supported).toContain('code');
      expect(data.grant_types_supported).toContain('authorization_code');
      expect(data.code_challenge_methods_supported).toContain('S256');
      expect(data.providers_supported).toContain('google');
      expect(data.providers_supported).toContain('github');
      expect(data.providers_supported).toContain('microsoft');
    });

    it('should support underscore variant', async () => {
      const response = await fetch(`${config.bffUrl}/.well-known/openid_configuration`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('issuer');
    });
  });

  describe('Callback Endpoints', () => {
    it('should handle OAuth callback without code', async () => {
      const response = await fetch(
        `${config.bffUrl}/auth/callback?state=test&error=access_denied`,
        {
          redirect: 'manual',
        }
      );

      expect(response.status).toBe(302);
      const location = response.headers.get('location');
      expect(location).toContain('error=access_denied');
    });
  });

  describe('Logout', () => {
    it('should handle logout request', async () => {
      const response = await fetch(`${config.bffUrl}/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer fake-token',
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe('Logged out successfully');
    });
  });
});
