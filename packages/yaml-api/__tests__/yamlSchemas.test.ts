import { describe, expect, it } from 'vitest';
import { getYamlSchema, YAML_SCHEMAS } from '../src/YAML_SCHEMAS.js';
import { YAML_SCHEMA_IDS } from '../src/YAML_SUBTYPE_REGISTRY.js';

describe('YAML schema registry', () => {
  it('is total for every canonical schema ID', () => {
    expect(Object.keys(YAML_SCHEMAS)).toEqual(YAML_SCHEMA_IDS);
  });

  it('defines the strict rsync schema without runtime-only properties', () => {
    expect(YAML_SCHEMAS['ide-gsm/rsync']).toEqual({
      $schema: 'http://json-schema.org/draft-07/schema#',
      title: 'Rsync',
      type: 'object',
      properties: {
        include: {
          type: 'array',
          items: { type: 'string' },
          title: 'Include',
        },
        exclude: {
          type: 'array',
          items: { type: 'string' },
          title: 'Exclude',
        },
      },
      additionalProperties: false,
    });
  });

  it('defines the strict git schema without runtime-only properties', () => {
    expect(YAML_SCHEMAS['ide-gsm/git']).toEqual({
      $schema: 'http://json-schema.org/draft-07/schema#',
      title: 'Git',
      type: 'object',
      properties: {
        url: {
          type: 'string',
          title: 'Repository URL',
          minLength: 1,
        },
      },
      required: ['url'],
      additionalProperties: false,
    });
  });

  it('keeps the existing permissive lookup contract for runtime consumers', () => {
    expect(getYamlSchema('ide-gsm/rsync')).toBe(YAML_SCHEMAS['ide-gsm/rsync']);
    expect(getYamlSchema('ide-gsm/unknown')).toBeUndefined();
  });
});
