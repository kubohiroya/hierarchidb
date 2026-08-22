import Ajv from 'ajv';
import type { TabularRow } from './types.js';

export const tabularRowJsonSchema = {
  $id: 'https://hierarchidb.dev/schemas/tabular-row.json',
  type: 'object',
  additionalProperties: { $ref: '#/$defs/tabularValue' },
  $defs: {
    tabularValue: {
      anyOf: [
        { type: 'string' },
        { type: 'number' },
        { type: 'boolean' },
        { type: 'null' },
        {
          type: 'array',
          items: { $ref: '#/$defs/tabularValue' },
        },
        {
          type: 'object',
          additionalProperties: { $ref: '#/$defs/tabularValue' },
        },
      ],
    },
  },
} as const;

const ajv = new Ajv({ allErrors: true, strict: true });
const validateTabularRow = ajv.compile(tabularRowJsonSchema);

export const isTabularRow = (value: unknown): value is TabularRow =>
  validateTabularRow(value) === true;
