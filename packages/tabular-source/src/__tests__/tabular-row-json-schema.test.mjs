import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isTabularRow } from '../../dist/index.js';

describe('tabular row JSON Schema', () => {
  it('accepts JSON-like row values', () => {
    assert.equal(
      isTabularRow({
        name: 'Station',
        count: 3,
        active: true,
        empty: null,
        nested: [{ value: 'x' }],
      }),
      true
    );
  });

  it('rejects non-object rows', () => {
    assert.equal(isTabularRow(['not', 'a', 'row']), false);
    assert.equal(isTabularRow(null), false);
  });

  it('rejects non-JSON property values without coercion', () => {
    const row = { count: undefined };
    assert.equal(isTabularRow(row), false);
    assert.equal(Object.hasOwn(row, 'count'), true);
  });
});
