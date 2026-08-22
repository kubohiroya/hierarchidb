import Ajv from 'ajv';
import type { FeatureCollection } from './types.js';

export const featureCollectionJsonSchema = {
  $id: 'https://hierarchidb.dev/schemas/feature-collection.json',
  type: 'object',
  required: ['type', 'features'],
  additionalProperties: true,
  properties: {
    type: { const: 'FeatureCollection' },
    features: {
      type: 'array',
      items: { $ref: '#/$defs/feature' },
    },
  },
  $defs: {
    propertyValue: {
      anyOf: [
        { type: 'string' },
        { type: 'number' },
        { type: 'boolean' },
        { type: 'null' },
        {
          type: 'array',
          items: { $ref: '#/$defs/propertyValue' },
        },
        {
          type: 'object',
          additionalProperties: { $ref: '#/$defs/propertyValue' },
        },
      ],
    },
    position: {
      type: 'array',
      minItems: 2,
      items: { type: 'number' },
    },
    coordinates: {
      anyOf: [
        { $ref: '#/$defs/position' },
        {
          type: 'array',
          items: { $ref: '#/$defs/coordinates' },
        },
      ],
    },
    geometry: {
      type: 'object',
      required: ['type'],
      additionalProperties: true,
      properties: {
        type: { type: 'string' },
        coordinates: { $ref: '#/$defs/coordinates' },
        geometries: {
          type: 'array',
          items: { $ref: '#/$defs/geometry' },
        },
      },
    },
    feature: {
      type: 'object',
      required: ['type', 'geometry'],
      additionalProperties: true,
      properties: {
        type: { const: 'Feature' },
        geometry: {
          anyOf: [{ $ref: '#/$defs/geometry' }, { type: 'null' }],
        },
        properties: {
          type: 'object',
          additionalProperties: { $ref: '#/$defs/propertyValue' },
        },
      },
    },
  },
} as const;

const ajv = new Ajv({ allErrors: true, strict: true });
const validateFeatureCollection = ajv.compile(featureCollectionJsonSchema);

export const assertFeatureCollection = (value: FeatureCollection): void => {
  if (validateFeatureCollection(value) !== true) {
    throw new Error('feature-collection-schema-invalid');
  }
};
