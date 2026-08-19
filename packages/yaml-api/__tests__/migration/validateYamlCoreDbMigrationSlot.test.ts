import { describe, expect, it } from 'vitest';
import { planYamlCoreDbMigration } from '../../src/migration/planYamlCoreDbMigration.js';
import { validateYamlCoreDbMigrationSlot } from '../../src/migration/validateYamlCoreDbMigrationSlot.js';

const LEGACY_PAYLOAD = {
  name: 'scenario.yml',
  schemaId: 'ide-gsm/scenario',
  content: 'name: demo\n',
} as const;

const CANONICAL_PAYLOAD = {
  subtype: 'scenario',
  schemaId: 'ide-gsm/scenario',
  content: 'name: demo\n',
} as const;

function validate(payload: unknown) {
  return validateYamlCoreDbMigrationSlot(payload, 'scenario.yml', 4, 'node-4', 'committed');
}

describe('validateYamlCoreDbMigrationSlot extraction parity', () => {
  it('preserves the exact legacy and canonical success objects', () => {
    expect(validate(LEGACY_PAYLOAD)).toEqual({
      ok: true,
      value: {
        classification: 'legacy',
        preimage: LEGACY_PAYLOAD,
        postimage: CANONICAL_PAYLOAD,
      },
    });
    expect(validate(CANONICAL_PAYLOAD)).toEqual({
      ok: true,
      value: { classification: 'canonical' },
    });
  });

  it.each([
    [
      'invalid payload',
      null,
      {
        code: 'INVALID_PAYLOAD',
        context: { field: 'data', reason: 'null' },
      },
    ],
    [
      'mixed before invalid fields',
      { ...CANONICAL_PAYLOAD, name: 'scenario.yml', schemaId: '' },
      { code: 'MIXED_PAYLOAD', context: { field: 'payload' } },
    ],
    [
      'unknown field before missing field',
      { subtype: 'scenario', schemaId: 'ide-gsm/scenario', extra: true },
      {
        code: 'UNKNOWN_PAYLOAD_FIELD',
        context: { field: 'payload', reason: 'unexpected-field' },
      },
    ],
    [
      'empty schema',
      { ...CANONICAL_PAYLOAD, schemaId: '' },
      {
        code: 'INVALID_PAYLOAD_FIELD',
        context: { field: 'schemaId', reason: 'empty' },
      },
    ],
    [
      'metadata mismatch',
      { ...LEGACY_PAYLOAD, name: 'scenario-base.yml' },
      {
        code: 'METADATA_PAYLOAD_NAME_MISMATCH',
        context: { field: 'name', reason: 'name-mismatch' },
      },
    ],
    [
      'registry mismatch before content validation',
      { ...CANONICAL_PAYLOAD, schemaId: 'ide-gsm/ssh', content: '{' },
      {
        code: 'UNKNOWN_REGISTRY_TUPLE',
        context: { field: 'payload', reason: 'registry-mismatch' },
      },
    ],
    [
      'invalid YAML',
      { ...CANONICAL_PAYLOAD, content: '{' },
      {
        code: 'INVALID_YAML',
        context: { field: 'content', reason: 'parse-failure' },
      },
    ],
  ])('preserves the exact baseline error for %s', (_label, payload, expected) => {
    expect(validate(payload)).toEqual({
      ok: false,
      error: {
        sourceIndex: 4,
        nodeId: 'node-4',
        slot: 'committed',
        ...expected,
      },
    });
  });

  it('preserves accessor precedence without invoking the getter', () => {
    let getterWasCalled = false;
    const payload: Record<string, unknown> = {
      subtype: 'scenario',
      schemaId: 'ide-gsm/scenario',
      extra: true,
    };
    Object.defineProperty(payload, 'content', {
      enumerable: true,
      get() {
        getterWasCalled = true;
        return 'name: demo\n';
      },
    });

    expect(validate(payload)).toEqual({
      ok: false,
      error: {
        sourceIndex: 4,
        nodeId: 'node-4',
        slot: 'committed',
        code: 'UNSAFE_PROPERTY_DESCRIPTOR',
        context: { field: 'payload', reason: 'accessor-property' },
      },
    });
    expect(getterWasCalled).toBe(false);
  });

  it('preserves the planner node-slot reflection error and redaction for a nested Proxy', async () => {
    const payload = new Proxy(LEGACY_PAYLOAD, {
      getPrototypeOf() {
        throw new Error('nested-proxy-token-must-not-leak');
      },
    });
    const result = await planYamlCoreDbMigration({
      migrationId: 'yaml-v1-to-v2',
      fromCoreDbVersion: 1,
      toCoreDbVersion: 2,
      rawNodes: [
        {
          id: 'nested-proxy',
          version: 1,
          nodeType: 'yaml-file',
          metadata: { name: 'scenario.yml' },
          draftMetadata: null,
          data: payload,
        },
      ],
      digestSha256Hex: async () => '0'.repeat(64),
    });

    expect(result).toEqual({
      ok: false,
      errors: [
        {
          sourceIndex: 0,
          nodeId: 'nested-proxy',
          slot: 'node',
          code: 'RAW_RECORD_ACCESS_FAILED',
          context: { reason: 'record-access-failure' },
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain('nested-proxy-token-must-not-leak');
  });
});
