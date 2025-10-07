import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const setPluginDefs = (defs: Array<Record<string, unknown>>) => {
  (globalThis as { __HDB_PLUGIN_DEFS__?: unknown }).__HDB_PLUGIN_DEFS__ = defs;
};

describe('pluginPresentation.getIconComponent', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete (globalThis as { __HDB_PLUGIN_DEFS__?: unknown }).__HDB_PLUGIN_DEFS__;
  });

  it('returns a valid React element when plugin metadata specifies an icon', async () => {
    setPluginDefs([
      {
        nodeType: 'folder',
        config: { icon: { muiIconName: 'Folder' } },
      },
    ]);

    const { getIconComponent } = await import('../pluginPresentation.js');
    const iconNode = getIconComponent('folder');

    expect(iconNode).toBeDefined();
    expect(React.isValidElement(iconNode)).toBe(true);
  });

  it('falls back to a default icon for unknown plugin-loader', async () => {
    const { getIconComponent } = await import('../pluginPresentation.js');
    const fallbackNode = getIconComponent('unknown-plugin');

    expect(fallbackNode).toBeDefined();
    expect(React.isValidElement(fallbackNode)).toBe(true);
  });
});
