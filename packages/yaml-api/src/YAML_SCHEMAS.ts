import { YAML_SCHEMA_IDS, type YamlSchemaId } from './YAML_SUBTYPE_REGISTRY.js';

/**
 * Declared JSON Schema constraints for each IDE-GSM schemaId.
 * UI and migration validation share these constraints. Consumers must not
 * infer constraints that are not declared by the selected schema.
 */
export const YAML_SCHEMAS: Readonly<Record<YamlSchemaId, object>> = {
  'ide-gsm/sources': {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'Sources',
    type: 'object',
    properties: {
      sources: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', title: 'Name' },
            url: { type: 'string', title: 'URL' },
          },
          required: ['name', 'url'],
        },
      },
    },
  },

  'ide-gsm/scenario': {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'Scenario',
    type: 'object',
    properties: {
      name: { type: 'string', title: 'Name' },
      description: { type: 'string', title: 'Description' },
      steps: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            action: { type: 'string', title: 'Action' },
            target: { type: 'string', title: 'Target' },
          },
          required: ['action'],
        },
      },
    },
    required: ['name'],
  },

  'ide-gsm/calib': {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'Calibration',
    type: 'object',
    properties: {
      calibrationId: { type: 'string', title: 'Calibration ID' },
      parameters: {
        type: 'object',
        additionalProperties: { type: 'number' },
        title: 'Parameters',
      },
    },
    required: ['calibrationId'],
  },

  'ide-gsm/remote': {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'Remote',
    type: 'object',
    properties: {
      host: { type: 'string', title: 'Host' },
      port: { type: 'integer', title: 'Port', minimum: 1, maximum: 65535 },
      username: { type: 'string', title: 'Username' },
    },
    required: ['host'],
  },

  'ide-gsm/ssh': {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'SSH',
    type: 'object',
    properties: {
      host: { type: 'string', title: 'Host' },
      port: { type: 'integer', title: 'Port', minimum: 1, maximum: 65535 },
      username: { type: 'string', title: 'Username' },
      privateKey: { type: 'string', title: 'Private Key' },
    },
    required: ['host', 'username'],
  },

  'ide-gsm/ec2': {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'EC2',
    type: 'object',
    properties: {
      instanceId: { type: 'string', title: 'Instance ID' },
      region: { type: 'string', title: 'Region' },
      instanceType: { type: 'string', title: 'Instance Type' },
    },
    required: ['instanceId', 'region'],
  },

  'ide-gsm/rsync': {
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
  },

  'ide-gsm/git': {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'Git',
    type: 'object',
    properties: {
      url: { type: 'string', title: 'Repository URL', minLength: 1 },
    },
    required: ['url'],
    additionalProperties: false,
  },
};

/**
 * Retrieve the JSON Schema object for a given schemaId.
 * Returns undefined when the schemaId is not registered.
 */
export function getYamlSchema(schemaId: string): object | undefined {
  const registeredSchemaId = YAML_SCHEMA_IDS.find((candidate) => candidate === schemaId);
  return registeredSchemaId === undefined ? undefined : YAML_SCHEMAS[registeredSchemaId];
}
