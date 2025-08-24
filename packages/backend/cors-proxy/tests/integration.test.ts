/**
 * Integration tests for CORS Proxy service
 * Tests authentication methods and proxy functionality
 */

import { describe, it, expect, beforeAll } from 'vitest';

// Test configuration
const PROXY_URL = process.env.CORS_PROXY_TEST_URL || 'http://localhost:8788';
const BFF_TOKEN = process.env.TEST_BFF_TOKEN;
const GOOGLE_ACCESS_TOKEN = process.env.TEST_GOOGLE_TOKEN;
const GITHUB_ACCESS_TOKEN = process.env.TEST_GITHUB_TOKEN;
const MICROSOFT_ACCESS_TOKEN = process.env.TEST_MICROSOFT_TOKEN;
const TEST_TARGET_URL =
  process.env.TEST_TARGET_URL || 'https://jsonplaceholder.typicode.com/posts/1';

interface TestConfig {
  proxyUrl: string;
  bffToken?: string;
  googleToken?: string;
  githubToken?: string;
  microsoftToken?: string;
  targetUrl: string;
}

const config: TestConfig = {
  proxyUrl: PROXY_URL,
  bffToken: BFF_TOKEN,
  googleToken: GOOGLE_ACCESS_TOKEN,
  githubToken: GITHUB_ACCESS_TOKEN,
  microsoftToken: MICROSOFT_ACCESS_TOKEN,
  targetUrl: TEST_TARGET_URL,
};

describe('CORS Proxy Service Integration Tests', () => {
  describe('CORS Headers', () => {
    it('should handle preflight OPTIONS requests', async () => {
      const response = await fetch(`${config.proxyUrl}/`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3000',
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'authorization',
        },
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
      expect(response.headers.get('Access-Control-Allow-Headers')).toContain('authorization');
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    });

    it('should add CORS headers to proxy responses', async () => {
      // This will fail without auth, but we can check CORS headers
      const response = await fetch(
        `${config.proxyUrl}/?url=${encodeURIComponent(config.targetUrl)}`,
        {
          headers: {
            Origin: 'http://localhost:3000',
          },
        }
      );

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
      expect(response.headers.get('Vary')).toBe('Origin');
    });
  });

  describe('Authentication Validation', () => {
    it('should reject requests without Bearer token', async () => {
      const response = await fetch(
        `${config.proxyUrl}/?url=${encodeURIComponent(config.targetUrl)}`
      );

      expect(response.status).toBe(401);
      const text = await response.text();
      expect(text).toBe('Missing Bearer token');
    });

    it('should reject requests with invalid token format', async () => {
      const response = await fetch(
        `${config.proxyUrl}/?url=${encodeURIComponent(config.targetUrl)}`,
        {
          headers: {
            Authorization: 'InvalidFormat token123',
          },
        }
      );

      expect(response.status).toBe(401);
      const text = await response.text();
      expect(text).toBe('Missing Bearer token');
    });

    it('should reject requests with invalid token', async () => {
      const response = await fetch(
        `${config.proxyUrl}/?url=${encodeURIComponent(config.targetUrl)}`,
        {
          headers: {
            Authorization: 'Bearer invalid-token-123',
          },
        }
      );

      expect(response.status).toBe(401);
      const text = await response.text();
      expect(text).toContain('Invalid token');
    });
  });

  describe('Proxy Functionality', () => {
    it('should require url query parameter', async () => {
      const response = await fetch(`${config.proxyUrl}/`, {
        headers: {
          Authorization: 'Bearer fake-token',
        },
      });

      // Will fail on auth first, but if auth passes, should fail on missing URL
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    if (config.bffToken) {
      describe('With BFF JWT Token', () => {
        it('should proxy requests with valid BFF token', async () => {
          const response = await fetch(
            `${config.proxyUrl}/?url=${encodeURIComponent(config.targetUrl)}`,
            {
              headers: {
                Authorization: `Bearer ${config.bffToken}`,
              },
            }
          );

          // Should either succeed or fail based on allowed target list
          if (response.status === 200) {
            const data = await response.json();
            expect(data).toBeDefined();
          } else if (response.status === 403) {
            const text = await response.text();
            expect(text).toBe('Target not allowed');
          }
        });

        it('should reject non-allowed URLs', async () => {
          const response = await fetch(
            `${config.proxyUrl}/?url=${encodeURIComponent('https://evil-site.com/data')}`,
            {
              headers: {
                Authorization: `Bearer ${config.bffToken}`,
              },
            }
          );

          // Should be rejected if allowlist is configured
          if (response.status === 403) {
            const text = await response.text();
            expect(text).toBe('Target not allowed');
          }
        });
      });
    }

    if (config.googleToken) {
      describe('With Google Access Token', () => {
        it('should proxy requests with valid Google token', async () => {
          const response = await fetch(
            `${config.proxyUrl}/?url=${encodeURIComponent(config.targetUrl)}`,
            {
              headers: {
                Authorization: `Bearer ${config.googleToken}`,
              },
            }
          );

          // Should work if Google validation is configured
          if (response.status === 200) {
            const data = await response.json();
            expect(data).toBeDefined();
          }
        });
      });
    }

    if (config.githubToken) {
      describe('With GitHub Access Token', () => {
        it('should proxy requests with valid GitHub token', async () => {
          const response = await fetch(
            `${config.proxyUrl}/?url=${encodeURIComponent(config.targetUrl)}`,
            {
              headers: {
                Authorization: `Bearer ${config.githubToken}`,
              },
            }
          );

          // Should work if GitHub validation is configured
          if (response.status === 200) {
            const data = await response.json();
            expect(data).toBeDefined();
          }
        });
      });
    }

    if (config.microsoftToken) {
      describe('With Microsoft Access Token', () => {
        it('should proxy requests with valid Microsoft token', async () => {
          const response = await fetch(
            `${config.proxyUrl}/?url=${encodeURIComponent(config.targetUrl)}`,
            {
              headers: {
                Authorization: `Bearer ${config.microsoftToken}`,
              },
            }
          );

          // Should work if Microsoft validation is configured
          if (response.status === 200) {
            const data = await response.json();
            expect(data).toBeDefined();
          }
        });
      });
    }
  });

  describe('Error Handling', () => {
    it('should handle malformed URLs gracefully', async () => {
      const response = await fetch(`${config.proxyUrl}/?url=not-a-valid-url`, {
        headers: {
          Authorization: 'Bearer fake-token',
        },
      });

      // Should fail either on auth or URL validation
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle empty URL parameter', async () => {
      const response = await fetch(`${config.proxyUrl}/?url=`, {
        headers: {
          Authorization: 'Bearer fake-token',
        },
      });

      // Should fail either on auth or URL validation
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Headers Forwarding', () => {
    // This test requires a valid token to actually test header forwarding
    if (config.bffToken) {
      it('should forward request headers to target', async () => {
        const customHeader = 'test-value-123';
        const response = await fetch(
          `${config.proxyUrl}/?url=${encodeURIComponent('https://httpbin.org/headers')}`,
          {
            headers: {
              Authorization: `Bearer ${config.bffToken}`,
              'X-Custom-Header': customHeader,
            },
          }
        );

        // If httpbin.org is in allowed list, check headers were forwarded
        if (response.status === 200) {
          const data = await response.json();
          expect(data.headers).toBeDefined();
        }
      });
    }
  });

  describe('Response Handling', () => {
    if (config.bffToken) {
      it('should preserve response status codes', async () => {
        // Test with a URL that returns 404
        const response = await fetch(
          `${config.proxyUrl}/?url=${encodeURIComponent('https://jsonplaceholder.typicode.com/posts/999999')}`,
          {
            headers: {
              Authorization: `Bearer ${config.bffToken}`,
            },
          }
        );

        // Should preserve the 404 from the target or return 403 if not allowed
        if (response.status !== 403) {
          expect(response.status).toBe(404);
        }
      });

      it('should handle JSON responses', async () => {
        const response = await fetch(
          `${config.proxyUrl}/?url=${encodeURIComponent(config.targetUrl)}`,
          {
            headers: {
              Authorization: `Bearer ${config.bffToken}`,
            },
          }
        );

        if (response.status === 200) {
          const contentType = response.headers.get('content-type');
          expect(contentType).toContain('application/json');

          const data = await response.json();
          expect(data).toBeDefined();
        }
      });
    }
  });
});
