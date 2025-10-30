import { describe, expect, beforeEach, afterEach, it, vi } from 'vitest';
import type { NodeType } from '@hierarchidb/feature-core/common-types';
import type { InstalledPlugin } from '../plugin-registry.js';
import {
  getPresentation,
  resetPluginPresentationCacheForTests,
} from '../plugin-presentation.js';

let mockDefinitions: InstalledPlugin[] = [];

vi.mock('../plugin-registry.js', async () => {
  const actual = await vi.importActual<typeof import('../plugin-registry.js')>('../plugin-registry.js');
  return {
    ...actual,
    getInstalledPlugins: () => mockDefinitions,
  };
});

const createPlugin = (overrides: Partial<InstalledPlugin>): InstalledPlugin => ({
  nodeType: overrides.nodeType ?? ('folder' as NodeType),
  packageName: overrides.packageName ?? '@hierarchidb/feature-core/folder-plugin',
  version: overrides.version ?? '0.0.0',
  manifest: overrides.manifest ?? null,
  hasUI: overrides.hasUI ?? true,
  hasWorker: overrides.hasWorker ?? true,
  hasCommon: overrides.hasCommon ?? false,
  hasDatabase: overrides.hasDatabase ?? false,
  label: overrides.label ?? 'Folder',
  icon: overrides.icon ?? {},
  iconColor: overrides.iconColor,
  backgroundColor: overrides.backgroundColor ?? '#eee',
  description: overrides.description ?? '',
  dependencies: overrides.dependencies ?? [],
  menuGroup: overrides.menuGroup ?? 'core',
  createOrder: overrides.createOrder ?? 1000,
  treeContext: overrides.treeContext ?? '*',
  categoryId: overrides.categoryId,
});

const sampleDefinitions: InstalledPlugin[] = [
  createPlugin({
    nodeType: 'folder' as NodeType,
    label: 'Folder',
    manifest: {
      displayName: 'Folder',
      icon: {
        mui: 'Folder',
        emoji: '📁',
        color: '#c0eeff',
      },
      priority: 5,
    } as InstalledPlugin['manifest'],
    icon: {
      muiIconName: 'Folder',
      emoji: '📁',
      color: '#c0eeff',
    },
  }),
  createPlugin({
    nodeType: 'location' as NodeType,
    label: 'Location',
    manifest: {
      displayName: 'Location',
      icon: {
        mui: 'LocationPin',
        color: '#ff3366',
      },
      priority: 20,
    } as InstalledPlugin['manifest'],
  }),
];

describe('plugin-presentation', () => {
  beforeEach(() => {
    mockDefinitions = JSON.parse(JSON.stringify(sampleDefinitions));
  });

  afterEach(() => {
    mockDefinitions = [];
  });

  it('returns manifest-provided icon metadata for known node types', () => {
    resetPluginPresentationCacheForTests();
    const folderPresentation = getPresentation('folder');
    expect(folderPresentation).toBeDefined();
    expect(folderPresentation?.label).toBe('Folder');
    expect(folderPresentation?.icon.muiIconName).toBe('Folder');
    expect(folderPresentation?.icon.color).toBe('#c0eeff');
    expect(folderPresentation?.priority).toBe(5);
  });

  it('normalizes legacy icon names when provided via manifest', () => {
    resetPluginPresentationCacheForTests();
    const locationPresentation = getPresentation('location');
    expect(locationPresentation).toBeDefined();
    expect(locationPresentation?.icon.muiIconName).toBe('LocationOn');
    expect(locationPresentation?.icon.color).toBe('#ff3366');
  });

  it('falls back to undefined when nodeType is not defined', () => {
    resetPluginPresentationCacheForTests();
    const missing = getPresentation('unknown-node');
    expect(missing).toBeUndefined();
  });

  it('refreshes cache after plugin definitions update (import template scenario)', () => {
    resetPluginPresentationCacheForTests();
    const first = getPresentation('folder');
    expect(first?.icon.color).toBe('#c0eeff');

    mockDefinitions = [
      createPlugin({
        nodeType: 'folder' as NodeType,
        manifest: {
          displayName: 'Folder',
          icon: {
            mui: 'Folder',
            color: '#ffeeaa',
          },
        } as InstalledPlugin['manifest'],
      }),
    ];

    resetPluginPresentationCacheForTests();
    const updated = getPresentation('folder');
    expect(updated?.icon.color).toBe('#ffeeaa');
  });
});
