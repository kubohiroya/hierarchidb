import { describe, expect, beforeEach, afterEach, it } from 'vitest';
import { getPresentation, resetPluginPresentationCacheForTests } from '../plugin-presentation.js';

interface FakePluginDefinition {
  nodeType: string;
  name?: string;
  config?: {
    name?: string;
    displayName?: string;
    priority?: number;
    icon?: {
      mui?: string;
      muiIconName?: string;
      emoji?: string;
      color?: string;
    };
  };
  priority?: number;
}

type GlobalDefs = typeof globalThis & { __HDB_PLUGIN_DEFS__?: unknown };

const globalWithDefs = globalThis as GlobalDefs;

const sampleDefinitions: FakePluginDefinition[] = [
  {
    nodeType: 'folder',
    name: 'Folder Plugin',
    config: {
      displayName: 'Folder',
      icon: {
        mui: 'Folder',
        emoji: '📁',
        color: '#c0eeff',
      },
      priority: 5,
    },
    priority: 10,
  },
  {
    nodeType: 'location',
    name: 'Location Plugin',
    config: {
      displayName: 'Location',
      icon: {
        mui: 'LocationPin',
        color: '#ff3366',
      },
      priority: 20,
    },
  },
];

describe('plugin-presentation', () => {
  const originalDefs = globalWithDefs.__HDB_PLUGIN_DEFS__;

  beforeEach(() => {
    resetPluginPresentationCacheForTests();
    globalWithDefs.__HDB_PLUGIN_DEFS__ = sampleDefinitions;
  });

  afterEach(() => {
    resetPluginPresentationCacheForTests();
    if (originalDefs !== undefined) {
      globalWithDefs.__HDB_PLUGIN_DEFS__ = originalDefs;
    } else {
      delete globalWithDefs.__HDB_PLUGIN_DEFS__;
    }
  });

  it('returns manifest-provided icon metadata for known node types', () => {
    const folderPresentation = getPresentation('folder');
    expect(folderPresentation).toBeDefined();
    expect(folderPresentation?.label).toBe('Folder');
    expect(folderPresentation?.icon.muiIconName).toBe('Folder');
    expect(folderPresentation?.icon.color).toBe('#c0eeff');
    expect(folderPresentation?.priority).toBe(5);
  });

  it('normalizes legacy icon names when provided via manifest', () => {
    const locationPresentation = getPresentation('location');
    expect(locationPresentation).toBeDefined();
    expect(locationPresentation?.icon.muiIconName).toBe('LocationOn');
    expect(locationPresentation?.icon.color).toBe('#ff3366');
  });

  it('falls back to undefined when nodeType is not defined', () => {
    const missing = getPresentation('unknown-node');
    expect(missing).toBeUndefined();
  });
});
