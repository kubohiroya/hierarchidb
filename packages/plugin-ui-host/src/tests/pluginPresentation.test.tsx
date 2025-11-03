import {
  getIconComponent,
  registerGlobalPluginDefinitions,
  resetPluginPresentationCacheForTests,
} from '@hierarchidb/plugin-presentation';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('plugin-presentation integration', () => {
  beforeEach(() => {
    resetPluginPresentationCacheForTests();
  });

  afterEach(() => {
    resetPluginPresentationCacheForTests();
  });

  it('returns a valid React element when plugin metadata specifies an icon', () => {
    registerGlobalPluginDefinitions([
      {
        nodeType: 'folder',
        manifest: { icon: { muiIconName: 'Folder' } },
      },
    ]);

    const iconNode = getIconComponent('folder');

    expect(iconNode).toBeDefined();
    expect(React.isValidElement(iconNode)).toBe(true);
  });

  it('falls back to a default icon for unknown plugin-loader', () => {
    resetPluginPresentationCacheForTests();
    const fallbackNode = getIconComponent('unknown-plugin');

    expect(fallbackNode).toBeDefined();
    expect(React.isValidElement(fallbackNode)).toBe(true);
  });
});
