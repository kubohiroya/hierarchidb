import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';

const schema = JSON.parse(
  await readFile(new URL('../plugin-manifest.schema.json', import.meta.url), 'utf8')
);

const ajv = new Ajv2020({
  strict: true,
  allErrors: true,
  coerceTypes: false,
  useDefaults: false,
  removeAdditional: false,
});
const validate = ajv.compile(schema);

describe('plugin manifest JSON Schema', () => {
  it('accepts the minimal required manifest contract', () => {
    assert.equal(
      validate({ id: '@hierarchidb/example-plugin', nodeType: 'example', version: '1.0.0' }),
      true
    );
  });

  it('rejects missing required fields', () => {
    assert.equal(validate({ id: '@hierarchidb/example-plugin', version: '1.0.0' }), false);
    assert.equal(validate.errors?.some((error) => error.keyword === 'required'), true);
  });

  it('rejects invalid required field types without coercion', () => {
    const manifest = { id: '@hierarchidb/example-plugin', nodeType: 'example', version: 1 };
    assert.equal(validate(manifest), false);
    assert.equal(manifest.version, 1);
  });

  it('keeps extension areas intentionally permissive', () => {
    assert.equal(
      validate({
        id: '@hierarchidb/example-plugin',
        nodeType: 'example',
        version: '1.0.0',
        customRootField: true,
        icon: { mui: 'Extension', customIconField: true },
        category: { treeId: 'r', customCategoryField: true },
      }),
      true
    );
  });
});
