import { describe, expect, it } from 'vitest';

import {
  isRetainedLegacyYamlDatabaseName,
  retainedLegacyYamlDatabaseNames,
} from '../retainedLegacyYamlDatabaseNames.js';

describe('retained legacy YamlDB database names', () => {
  it('documents the exact retained production YamlDB name', () => {
    expect(retainedLegacyYamlDatabaseNames).toEqual(['hierarchidb-yaml']);
  });

  it('matches only exact retained names without suffix or prefix inference', () => {
    expect(isRetainedLegacyYamlDatabaseName('hierarchidb-yaml')).toBe(true);
    expect(isRetainedLegacyYamlDatabaseName('cart-yaml')).toBe(false);
    expect(isRetainedLegacyYamlDatabaseName('hierarchidb-yaml-copy')).toBe(false);
    expect(isRetainedLegacyYamlDatabaseName('prefix-hierarchidb-yaml')).toBe(false);
    expect(isRetainedLegacyYamlDatabaseName('hierarchidb-core')).toBe(false);
  });
});
