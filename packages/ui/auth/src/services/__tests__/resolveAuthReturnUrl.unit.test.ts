import { describe, expect, it } from 'vitest';
import { resolveAuthReturnUrl } from '../resolveAuthReturnUrl.js';

const githubPagesOptions = {
  appBasePath: '/hierarchidb/',
  currentOrigin: 'https://kubohiroya.github.io',
  routerMode: 'hash' as const,
};

describe('resolveAuthReturnUrl', () => {
  it('resolves the GitHub Pages Step5 fixture without duplicating the node id', () => {
    const nodeId = '90d6c659-58f2-4912-b6d5-96bc5dd7d4f2';
    const rawUrl = `https://kubohiroya.github.io/hierarchidb/#/t/r/${nodeId}/shape/edit/normal/5`;

    expect(resolveAuthReturnUrl(rawUrl, githubPagesOptions)).toEqual({
      isExternal: false,
      url: `#/t/r/${nodeId}/shape/edit/normal/5`,
    });
  });

  it('uses the hash route directly instead of combining it with the base pathname', () => {
    expect(
      resolveAuthReturnUrl('/hierarchidb/?callback=1#/t/r/node-1/shape/edit/normal/5', {
        ...githubPagesOptions,
      })
    ).toEqual({
      isExternal: false,
      url: '#/t/r/node-1/shape/edit/normal/5',
    });
  });

  it('converts a base-prefixed pathname to a hash route when no hash is present', () => {
    expect(resolveAuthReturnUrl('/hierarchidb/t/r/node-1?step=5', githubPagesOptions)).toEqual({
      isExternal: false,
      url: '#/t/r/node-1?step=5',
    });
  });

  it.each([
    ['/', '#/'],
    ['/t/r/node-1/shape/edit/normal/5', '#/t/r/node-1/shape/edit/normal/5'],
  ])('accepts an app-relative route in hash mode: %s', (rawUrl, expectedUrl) => {
    expect(resolveAuthReturnUrl(rawUrl, githubPagesOptions)).toEqual({
      isExternal: false,
      url: expectedUrl,
    });
  });

  it('removes the app base path for browser routing', () => {
    expect(
      resolveAuthReturnUrl('https://example.com/hierarchidb/t/r/node-1?step=5#details', {
        appBasePath: '/hierarchidb/',
        currentOrigin: 'https://example.com',
        routerMode: 'browser',
      })
    ).toEqual({
      isExternal: false,
      url: '/t/r/node-1?step=5#details',
    });
  });

  it('supports an application hosted at the origin root', () => {
    expect(
      resolveAuthReturnUrl('/t/r/node-1', {
        appBasePath: '/',
        currentOrigin: 'https://example.com',
        routerMode: 'browser',
      })
    ).toEqual({ isExternal: false, url: '/t/r/node-1' });
  });

  it('preserves an external return URL as an absolute URL', () => {
    expect(
      resolveAuthReturnUrl('https://example.net/after-auth?source=hierarchidb', githubPagesOptions)
    ).toEqual({
      isExternal: true,
      url: 'https://example.net/after-auth?source=hierarchidb',
    });
  });

  it.each([
    ['', 'empty URL'],
    ['https://[invalid', 'malformed URL'],
    ['https://kubohiroya.github.io/other/path', 'same-origin path outside the app base'],
    ['https://kubohiroya.github.io/hierarchidb/#fragment', 'non-route hash'],
    ['javascript:alert(1)', 'non-HTTP protocol'],
  ])('rejects %s (%s)', (rawUrl) => {
    expect(() => resolveAuthReturnUrl(rawUrl, githubPagesOptions)).toThrow();
  });

  it.each(['hierarchidb', '/hierarchidb/?query=1', '/hierarchidb/#fragment'])(
    'rejects an invalid app base path: %s',
    (appBasePath) => {
      expect(() =>
        resolveAuthReturnUrl('/hierarchidb/#/t/r', {
          ...githubPagesOptions,
          appBasePath,
        })
      ).toThrow();
    }
  );
});
