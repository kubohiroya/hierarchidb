import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHierarchiRouter, getRouterMode, getBasePath } from '../index.js';

describe('createHierarchiRouter', () => {
  beforeEach(() => {
    // Reset environment variables
    vi.unstubAllEnvs();
  });

  it('should create a router with browser mode', () => {
    const router = createHierarchiRouter({ mode: 'browser' });
    
    expect(router).toBeDefined();
    expect(router.history).toBeDefined();
    expect(router.history.location).toBeDefined();
  });

  it('should create a router with hash mode', () => {
    const router = createHierarchiRouter({ mode: 'hash' });
    
    expect(router).toBeDefined();
    expect(router.history).toBeDefined();
    expect(router.history.location).toBeDefined();
  });

  it('should apply basename when provided', () => {
    const router = createHierarchiRouter({ 
      mode: 'browser', 
      basename: '/hierarchidb' 
    });
    
    expect(router).toBeDefined();
    expect(router.history).toBeDefined();
  });

  it('should not apply basename for hash mode', () => {
    const router = createHierarchiRouter({ 
      mode: 'hash', 
      basename: '/hierarchidb' 
    });
    
    expect(router).toBeDefined();
    expect(router.history).toBeDefined();
  });
});

describe('getRouterMode', () => {
  it('should return "browser" by default', () => {
    expect(getRouterMode()).toBe('browser');
  });

  it('should return "hash" when VITE_ROUTER_MODE is "hash"', () => {
    vi.stubEnv('VITE_ROUTER_MODE', 'hash');
    expect(getRouterMode()).toBe('hash');
  });

  it('should return "browser" when VITE_ROUTER_MODE is "browser"', () => {
    vi.stubEnv('VITE_ROUTER_MODE', 'browser');
    expect(getRouterMode()).toBe('browser');
  });

  it('should handle case insensitivity', () => {
    vi.stubEnv('VITE_ROUTER_MODE', 'HASH');
    expect(getRouterMode()).toBe('hash');
  });

  it('should default to "browser" for invalid values', () => {
    vi.stubEnv('VITE_ROUTER_MODE', 'invalid');
    expect(getRouterMode()).toBe('browser');
  });
});

describe('getBasePath', () => {
  it('should return "/" by default', () => {
    expect(getBasePath()).toBe('/');
  });

  it('should remove trailing slash from BASE_URL', () => {
    vi.stubEnv('BASE_URL', '/hierarchidb/');
    expect(getBasePath()).toBe('/hierarchidb');
  });

  it('should keep path without trailing slash', () => {
    vi.stubEnv('BASE_URL', '/hierarchidb');
    expect(getBasePath()).toBe('/hierarchidb');
  });

  it('should handle root path specially', () => {
    vi.stubEnv('BASE_URL', '/');
    expect(getBasePath()).toBe('/');
  });
});
