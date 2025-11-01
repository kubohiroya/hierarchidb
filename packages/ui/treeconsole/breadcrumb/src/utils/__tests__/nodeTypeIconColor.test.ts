import { describe, expect, it } from 'vitest';
import { getPluginIconColor, isFolderNodeType } from '../nodeTypeIconColor.js';

describe('nodeTypeIconColor helpers', () => {
  it('returns manifest color for known plugin node type', () => {
    expect(getPluginIconColor('basemap')).toBe('#b0b3d9');
  });

  it('returns undefined for unknown node types', () => {
    expect(getPluginIconColor('unknown-node-type')).toBeUndefined();
  });

  it('detects folder-like node types', () => {
    expect(isFolderNodeType('folder')).toBe(true);
    expect(isFolderNodeType('ProjectFolder')).toBe(true);
    expect(isFolderNodeType('location')).toBe(false);
  });
});
