import type { SvgIconProps } from '@mui/material/SvgIcon';
import type { ComponentType } from 'react';
import { describe, expect, it } from 'vitest';
import { pluginIconLoaders } from '~/plugin-loaders/icon-loaders.ts';

function isReactComponent(value: unknown): value is ComponentType<SvgIconProps> {
  if (typeof value === 'function') {
    return true;
  }
  if (typeof value === 'object' && value !== null) {
    const maybe = value as { $$typeof?: unknown };
    return typeof maybe.$$typeof === 'symbol';
  }
  return false;
}

describe('plugin icon loaders', () => {
  it('returns React components for published plugin icons', async () => {
    const entries = Object.entries(pluginIconLoaders);
    expect(entries.length).toBeGreaterThan(0);

    const results = await Promise.all(
      entries.map(async ([nodeType, loadIcon]) => {
        const resolved = await loadIcon();
        return { nodeType, resolved };
      })
    );

    const invalid = results.filter(({ resolved }) => !isReactComponent(resolved));

    expect(invalid, 'all plugin icon loaders should resolve to a React component').toEqual([]);
  });
});
