import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parse, stringify } from 'yaml';

// Feature: yaml-file-node, Property 7: JSON-to-YAML round-trip
// Only JSON-serializable objects are in scope: rjsf form data never contains `undefined`.
// YAML has no undefined concept; it maps undefined to null, so we exclude undefined from inputs.
describe('Property 7: JSON-to-YAML round-trip', () => {
  it('stringify then parse produces a deeply equal object', () => {
    fc.assert(
      fc.property(
        // fc.jsonValue() generates only JSON-serializable values (no undefined)
        // wrapped in a record to match the rjsf form output shape
        fc.dictionary(fc.string(), fc.jsonValue()),
        (obj) => {
          const yamlText = stringify(obj);
          const parsed = parse(yamlText);
          expect(parsed).toEqual(obj);
        }
      ),
      { numRuns: 100 }
    );
  });
});
