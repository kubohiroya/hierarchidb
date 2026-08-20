import { describe, expect, it } from 'vitest';
import { validateYamlCanonicalPayload } from '../../src/validation/validateYamlCanonicalPayload.js';
import { YAML_SUBTYPE_REGISTRY } from '../../src/YAML_SUBTYPE_REGISTRY.js';
import type { YamlSubtype } from '../../src/YamlSubtype.js';

const VALID_CONTENT: Readonly<Record<YamlSubtype, string>> = {
  sources: 'sources: []\n',
  scenario: 'name: demo\n',
  'scenario-base': 'name: demo\n',
  calib: 'calibrationId: calibration-1\n',
  remote: 'host: remote.example.test\n',
  'remote-base': 'host: remote.example.test\n',
  ssh: 'host: ssh.example.test\nusername: user\n',
  'ssh-base': 'host: ssh.example.test\nusername: user\n',
  ec2: 'instanceId: i-123\nregion: ap-northeast-1\n',
  'ec2-base': 'instanceId: i-123\nregion: ap-northeast-1\n',
  rsync: 'include: []\nexclude: []\n',
  git: 'url: https://example.test/repository.git\n',
};

function canonicalPayload(subtype: YamlSubtype): Readonly<Record<string, unknown>> {
  const entry = YAML_SUBTYPE_REGISTRY[subtype];
  return {
    subtype,
    schemaId: entry.schemaId,
    content: VALID_CONTENT[subtype],
  };
}

function expectErrorCode(filename: unknown, payload: unknown): string {
  const result = validateYamlCanonicalPayload(filename, payload);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('Expected validation failure');
  return result.error.code;
}

describe('validateYamlCanonicalPayload registry contract', () => {
  it.each(Object.values(YAML_SUBTYPE_REGISTRY))(
    'validates the exact $subtype canonical tuple',
    (entry) => {
      const input = canonicalPayload(entry.subtype);
      const result = validateYamlCanonicalPayload(entry.fileName, input);

      expect(result).toEqual({
        ok: true,
        value: {
          subtype: entry.subtype,
          schemaId: entry.schemaId,
          content: VALID_CONTENT[entry.subtype],
        },
      });
      if (!result.ok) throw new Error('Expected validation success');
      expect(result.value).not.toBe(input);
    }
  );

  it.each([
    ['unknown subtype', 'scenario.yml', { ...canonicalPayload('scenario'), subtype: 'unknown' }],
    ['wrong schema', 'scenario.yml', { ...canonicalPayload('scenario'), schemaId: 'ide-gsm/ssh' }],
    ['wrong filename', 'scenario-base.yml', canonicalPayload('scenario')],
  ])('rejects %s without inferring a registry value', (_label, filename, payload) => {
    expect(expectErrorCode(filename, payload)).toBe('UNKNOWN_REGISTRY_TUPLE');
  });

  it.each([
    ['empty filename', '', canonicalPayload('scenario'), 'INVALID_FILENAME'],
    ['non-string filename', 1, canonicalPayload('scenario'), 'INVALID_FILENAME'],
    [
      'legacy payload',
      'scenario.yml',
      { name: 'scenario.yml', schemaId: 'ide-gsm/scenario', content: 'name: demo\n' },
      'LEGACY_PAYLOAD',
    ],
    [
      'mixed payload',
      'scenario.yml',
      { ...canonicalPayload('scenario'), name: 'scenario.yml' },
      'MIXED_PAYLOAD',
    ],
    [
      'host-split legacy payload',
      'scenario.yml',
      { schemaId: 'ide-gsm/scenario', content: 'name: demo\n' },
      'INCOMPLETE_PAYLOAD',
    ],
    ['array payload', 'scenario.yml', [], 'INVALID_PAYLOAD'],
    ['non-plain payload', 'scenario.yml', new Date(0), 'INVALID_PAYLOAD'],
  ])('rejects %s with a stable code', (_label, filename, payload, expectedCode) => {
    expect(expectErrorCode(filename, payload)).toBe(expectedCode);
  });

  it('rejects string and symbol extra own keys', () => {
    const withStringKey = { ...canonicalPayload('scenario'), extra: true };
    const withSymbolKey = canonicalPayload('scenario') as Record<PropertyKey, unknown>;
    Object.defineProperty(withSymbolKey, Symbol('secret-symbol'), {
      value: true,
      enumerable: true,
    });

    expect(expectErrorCode('scenario.yml', withStringKey)).toBe('UNKNOWN_PAYLOAD_FIELD');
    expect(expectErrorCode('scenario.yml', withSymbolKey)).toBe('UNKNOWN_PAYLOAD_FIELD');
  });

  it('rejects an accessor without invoking its getter', () => {
    let getterWasCalled = false;
    const payload: Record<string, unknown> = {
      subtype: 'scenario',
      schemaId: 'ide-gsm/scenario',
    };
    Object.defineProperty(payload, 'content', {
      enumerable: true,
      get() {
        getterWasCalled = true;
        throw new Error('getter-token-must-not-leak');
      },
    });

    const result = validateYamlCanonicalPayload('scenario.yml', payload);
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'UNSAFE_PROPERTY_DESCRIPTOR',
        context: { field: 'payload', reason: 'accessor-property' },
      },
    });
    expect(getterWasCalled).toBe(false);
    expect(JSON.stringify(result)).not.toContain('getter-token-must-not-leak');
  });

  it('converts a Proxy reflection trap into a stable redacted error', () => {
    const payload = new Proxy(canonicalPayload('scenario'), {
      ownKeys() {
        throw new Error('proxy-credential-must-not-leak');
      },
    });

    const result = validateYamlCanonicalPayload('scenario.yml', payload);
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'PAYLOAD_ACCESS_FAILED',
        context: { field: 'payload', reason: 'reflection-failure' },
      },
    });
    expect(JSON.stringify(result)).not.toContain('proxy-credential-must-not-leak');
  });
});

describe('validateYamlCanonicalPayload YAML and schema contract', () => {
  it.each([
    ['parse failure', '{', 'INVALID_YAML'],
    ['duplicate key', 'name: first\nname: second\n', 'INVALID_YAML'],
    ['parser warning', 'name: !unknown-tag demo\n', 'INVALID_YAML'],
    ['multiple documents', 'name: one\n---\nname: two\n', 'MULTIPLE_YAML_DOCUMENTS'],
    ['scalar root', 'scalar\n', 'YAML_ROOT_NOT_MAPPING'],
    ['sequence root', '- name: demo\n', 'YAML_ROOT_NOT_MAPPING'],
    ['null root', 'null\n', 'YAML_ROOT_NOT_MAPPING'],
  ])('rejects %s', (_label, content, expectedCode) => {
    expect(
      expectErrorCode('scenario.yml', {
        subtype: 'scenario',
        schemaId: 'ide-gsm/scenario',
        content,
      })
    ).toBe(expectedCode);
  });

  it.each([
    ['rsync', 'include: []\nunexpected: true\n'],
    ['git', 'url: https://example.test/repo.git\nunexpected: true\n'],
  ] as const)('enforces declared additionalProperties:false for %s', (subtype, content) => {
    const entry = YAML_SUBTYPE_REGISTRY[subtype];
    expect(expectErrorCode(entry.fileName, { subtype, schemaId: entry.schemaId, content })).toBe(
      'CONTENT_SCHEMA_INVALID'
    );
  });

  it('does not coerce schema values', () => {
    expect(
      expectErrorCode('remote.yml', {
        subtype: 'remote',
        schemaId: 'ide-gsm/remote',
        content: 'host: remote.example.test\nport: "22"\n',
      })
    ).toBe('CONTENT_SCHEMA_INVALID');
  });

  it('does not inject an undeclared additional-properties ban', () => {
    const content = 'name: demo\ncustomProperty: allowed-by-declared-schema\n';
    const result = validateYamlCanonicalPayload('scenario.yml', {
      subtype: 'scenario',
      schemaId: 'ide-gsm/scenario',
      content,
    });

    expect(result).toEqual({
      ok: true,
      value: { subtype: 'scenario', schemaId: 'ide-gsm/scenario', content },
    });
  });

  it('does not mutate or serialize frozen input and preserves content byte-for-byte', () => {
    const content = 'name: unchanged\n';
    const payload = Object.freeze({
      subtype: 'scenario',
      schemaId: 'ide-gsm/scenario',
      content,
    });
    const result = validateYamlCanonicalPayload('scenario.yml', payload);

    expect(result).toEqual({
      ok: true,
      value: { subtype: 'scenario', schemaId: 'ide-gsm/scenario', content },
    });
    expect(payload.content).toBe(content);
  });
});
