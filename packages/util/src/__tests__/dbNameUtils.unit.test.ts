import { describe, expect, it } from 'vitest';
import { getBuildDatabasePrefix, getDBName } from '../dbNameUtils.js';

describe('database name authority', () => {
  it('creates a name only from exact explicit components', () => {
    expect(getDBName('hierarchidb', 'core')).toBe('hierarchidb-core');
    expect(getDBName('cart-test', 'route-metadata')).toBe('cart-test-route-metadata');
  });

  it.each([
    ['', 'core', 'database-prefix-required'],
    [' ', 'core', 'database-prefix-invalid'],
    ['HDB', 'core', 'database-prefix-invalid'],
    ['hierarchidb', '', 'database-suffix-required'],
    ['hierarchidb', ' core', 'database-suffix-invalid'],
    ['hierarchidb', 'route_metadata', 'database-suffix-invalid'],
  ])('rejects prefix %j and suffix %j with %s', (prefix, suffix, code) => {
    expect(() => getDBName(prefix, suffix)).toThrow(code);
  });

  it('fails closed when the application build prefix is unavailable', () => {
    expect(() => getBuildDatabasePrefix()).toThrow('database-prefix-required');
  });
});
