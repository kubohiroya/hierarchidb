import { describe, expect, it } from 'vitest';
import { resolveDefaultNodeName } from '../../../utils/default-node-name.js';

describe('resolveDefaultNodeName', () => {
  it('uses plugin manifest displayName when available', () => {
    expect(resolveDefaultNodeName('folder')).toBe('New Folder');
  });

  it('normalizes nodeType suffixes', () => {
    expect(resolveDefaultNodeName('folder-plugin')).toBe('New Folder');
  });

  it('falls back to title case when metadata is missing', () => {
    expect(resolveDefaultNodeName('custom-node')).toBe('New Custom Node');
  });
});
