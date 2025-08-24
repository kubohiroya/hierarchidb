/**
 * End-to-end tests for CORS Proxy service deployed on Cloudflare
 * Run these tests against your deployed service
 */

import { describe, it, expect, beforeAll } from 'vitest';

// Production/staging URLs - set via environment variables
const DEPLOYED_PROXY_URL = process.env.DEPLOYED_CORS_PROXY_URL;
const DEPLOYED_BFF_URL = process.env.DEPLOYED_BFF_URL;
const TEST_BFF_TOKEN = process.env.TEST_BFF_TOKEN;

// Skip E2E tests if no deployed URL is provided
const skipE2E = !DEPLOYED_PROXY_URL;

describe.skipIf(skipE2E)('CORS Proxy E2E Tests (Deployed)', () => {
  beforeAll(() => {
    if (!DEPLOYED_PROXY_URL) {
      console.log('Skipping E2E tests - DEPLOYED_CORS_PROXY_URL not set');
      console.log(
        'To run E2E tests: DEPLOYED_CORS_PROXY_URL=https://your-proxy.workers.dev npm test'
      );
    }
  });

  describe('Service Availability', () => {
    it('should be accessible and return proper CORS headers', async () => {
      const response = await fetch(`${DEPLOYED_PROXY_URL}/`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://your-app.com',
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'authorization',
        },
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://your-app.com');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    });
  });

  describe('Authentication', () => {
    it('should reject requests without authentication', async () => {
      const response = await fetch(
        `${DEPLOYED_PROXY_URL}/?url=${encodeURIComponent('https://api.github.com/meta')}`
      );

      expect(response.status).toBe(401);
      const text = await response.text();
      expect(text).toBe('Missing Bearer token');
    });

    it('should reject invalid tokens', async () => {
      const response = await fetch(
        `${DEPLOYED_PROXY_URL}/?url=${encodeURIComponent('https://api.github.com/meta')}`,
        {
          headers: {
            Authorization: 'Bearer invalid-token-12345',
          },
        }
      );

      expect(response.status).toBe(401);
      const text = await response.text();
      expect(text).toContain('Invalid token');
    });
  });

  if (TEST_BFF_TOKEN) {
    describe('Proxy Functionality with BFF Token', () => {
      it('should proxy allowed URLs', async () => {
        // This assumes jsonplaceholder is in the allowed list
        const response = await fetch(
          `${DEPLOYED_PROXY_URL}/?url=${encodeURIComponent('https://jsonplaceholder.typicode.com/posts/1')}`,
          {
            headers: {
              Authorization: `Bearer ${TEST_BFF_TOKEN}`,
            },
          }
        );

        if (response.status === 200) {
          const data = await response.json();
          expect(data).toHaveProperty('id');
          expect(data).toHaveProperty('title');
        } else if (response.status === 403) {
          const text = await response.text();
          expect(text).toBe('Target not allowed');
        }
      });

      it('should block non-allowed URLs', async () => {
        const response = await fetch(
          `${DEPLOYED_PROXY_URL}/?url=${encodeURIComponent('https://evil-website.com/data')}`,
          {
            headers: {
              Authorization: `Bearer ${TEST_BFF_TOKEN}`,
            },
          }
        );

        expect(response.status).toBe(403);
        const text = await response.text();
        expect(text).toBe('Target not allowed');
      });

      it('should preserve response headers and status', async () => {
        const response = await fetch(
          `${DEPLOYED_PROXY_URL}/?url=${encodeURIComponent('https://httpbin.org/status/418')}`,
          {
            headers: {
              Authorization: `Bearer ${TEST_BFF_TOKEN}`,
            },
          }
        );

        // If httpbin.org is allowed, should get 418 (I'm a teapot)
        if (response.status !== 403) {
          expect(response.status).toBe(418);
        }
      });
    });
  }

  describe('Cross-Origin Requests', () => {
    it('should handle cross-origin requests properly', async () => {
      const response = await fetch(
        `${DEPLOYED_PROXY_URL}/?url=${encodeURIComponent('https://api.github.com/meta')}`,
        {
          headers: {
            Origin: 'https://your-app.com',
            Authorization: 'Bearer fake-token',
          },
        }
      );

      // Check CORS headers are present even on error responses
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://your-app.com');
      expect(response.headers.get('Vary')).toBe('Origin');
    });
  });

  describe('Integration with BFF', () => {
    if (DEPLOYED_BFF_URL && TEST_BFF_TOKEN) {
      it('should accept tokens issued by BFF service', async () => {
        // First verify the token with BFF
        const verifyResponse = await fetch(`${DEPLOYED_BFF_URL}/auth/verify`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${TEST_BFF_TOKEN}`,
          },
        });

        if (verifyResponse.status === 200) {
          // Then use the same token with CORS proxy
          const proxyResponse = await fetch(
            `${DEPLOYED_PROXY_URL}/?url=${encodeURIComponent('https://api.github.com/meta')}`,
            {
              headers: {
                Authorization: `Bearer ${TEST_BFF_TOKEN}`,
              },
            }
          );

          // Should accept the BFF token
          expect(proxyResponse.status).not.toBe(401);
        }
      });
    }
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const response = await fetch(
        `${DEPLOYED_PROXY_URL}/?url=${encodeURIComponent('https://non-existent-domain-12345.com')}`,
        {
          headers: {
            Authorization: `Bearer ${TEST_BFF_TOKEN || 'fake-token'}`,
          },
        }
      );

      // Should fail gracefully
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should reject malformed URLs', async () => {
      const response = await fetch(`${DEPLOYED_PROXY_URL}/?url=not-a-url`, {
        headers: {
          Authorization: `Bearer ${TEST_BFF_TOKEN || 'fake-token'}`,
        },
      });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Performance', () => {
    it('should handle concurrent requests', async () => {
      const token = TEST_BFF_TOKEN || 'fake-token';
      const requests = Array(3)
        .fill(null)
        .map(() =>
          fetch(`${DEPLOYED_PROXY_URL}/?url=${encodeURIComponent('https://api.github.com/meta')}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })
        );

      const responses = await Promise.all(requests);

      // All should return the same status
      const statuses = responses.map((r) => r.status);
      expect(new Set(statuses).size).toBe(1);
    });
  });
});
