import { describe, it, expect, beforeEach } from 'vitest';
import {
  setPluginPresentationDefinitions,
  getPresentation,
  getIconComponent,
  prefetchAllIcons,
  resetPluginPresentationCacheForTests,
} from '~/index';

const baseDefinition = {
  nodeType: 'folder',
  label: 'Folder',
};

describe('plugin-presentation', () => {
  beforeEach(() => {
    resetPluginPresentationCacheForTests();
  });

  it('returns presentation for known node type', () => {
    setPluginPresentationDefinitions([baseDefinition]);
    const presentation = getPresentation('folder');
    expect(presentation).toBeDefined();
    expect(presentation?.label).toBe('Folder');
    expect(presentation?.icon.muiIconName).toBe('Folder');
  });

  it('normalizes label and icon from manifest data', () => {
    setPluginPresentationDefinitions([
      {
        nodeType: 'location-plugin',
        label: 'Location Plugin',
        manifest: {
          icon: {
            muiIconName: 'LocationPin',
          },
          description: '  Location nodes with spatial data  ',
        },
      },
    ]);
    const presentation = getPresentation('location-plugin');
    expect(presentation?.label).toBe('Location');
    expect(presentation?.icon.muiIconName).toBe('LocationOn');
    expect(presentation?.description).toBe('Location nodes with spatial data');
    const iconNode = getIconComponent('location-plugin');
    expect(iconNode).toBeDefined();
  });

  it('prefetches icons without throwing when cache is empty', async () => {
    setPluginPresentationDefinitions([]);
    await expect(prefetchAllIcons()).resolves.toBeUndefined();
  });
});
