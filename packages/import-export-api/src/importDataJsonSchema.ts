export const importDataJsonSchema = {
  $id: 'https://hierarchidb.dev/schemas/import-data.json',
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['nodes'],
  additionalProperties: false,
  properties: {
    nodes: {
      type: 'array',
      items: { $ref: '#/$defs/importNode' },
    },
    metadata: {
      type: 'object',
      additionalProperties: false,
      properties: {
        version: { type: 'string' },
        createdAt: { type: 'number' },
        source: { type: 'string' },
      },
    },
  },
  $defs: {
    jsonValue: {
      anyOf: [
        { type: 'string' },
        { type: 'number' },
        { type: 'boolean' },
        { type: 'null' },
        {
          type: 'array',
          items: { $ref: '#/$defs/jsonValue' },
        },
        {
          type: 'object',
          additionalProperties: { $ref: '#/$defs/jsonValue' },
        },
      ],
    },
    metadataRecord: {
      type: 'object',
      additionalProperties: { $ref: '#/$defs/jsonValue' },
    },
    importNode: {
      type: 'object',
      required: ['name'],
      additionalProperties: false,
      properties: {
        name: { type: 'string', minLength: 1 },
        nodeType: { type: 'string', minLength: 1 },
        parentNodeId: { type: 'string', minLength: 1 },
        version: { type: 'integer', minimum: 1 },
        description: { type: 'string' },
        tags: {
          type: 'array',
          items: { type: 'string' },
        },
        metadata: { $ref: '#/$defs/metadataRecord' },
        data: { $ref: '#/$defs/jsonValue' },
        draftData: { $ref: '#/$defs/jsonValue' },
        draftMetadata: {
          anyOf: [{ $ref: '#/$defs/metadataRecord' }, { type: 'null' }],
        },
        children: {
          type: 'array',
          items: { $ref: '#/$defs/importNode' },
        },
      },
    },
  },
} as const;
