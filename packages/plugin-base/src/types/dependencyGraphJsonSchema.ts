import Ajv from 'ajv';
import type { DependencyGraph } from './PluginTreeAPI.js';

export const dependencyGraphJsonSchema = {
  $id: 'https://hierarchidb.dev/schemas/plugin-dependency-graph.json',
  type: 'object',
  required: ['treeId', 'nodes', 'edges', 'metadata'],
  additionalProperties: true,
  properties: {
    treeId: { type: 'string' },
    nodes: {
      type: 'array',
      items: {
        type: 'object',
        required: ['nodeType', 'label'],
        additionalProperties: true,
        properties: {
          nodeType: { type: 'string' },
          label: { type: 'string' },
          metrics: { $ref: '#/$defs/metricMap' },
        },
      },
    },
    edges: {
      type: 'array',
      items: {
        type: 'object',
        required: ['from', 'to', 'type'],
        additionalProperties: true,
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
          type: { type: 'string' },
        },
      },
    },
    metadata: {
      type: 'object',
      required: ['totalPlugins', 'hasCycles'],
      additionalProperties: true,
      properties: {
        totalPlugins: { type: 'number' },
        hasCycles: { type: 'boolean' },
      },
    },
    layout: { type: 'string' },
    groups: {
      anyOf: [
        {
          type: 'array',
          items: { $ref: '#/$defs/dependencyGraphGroup' },
        },
        {
          type: 'object',
          additionalProperties: { $ref: '#/$defs/dependencyGraphGroup' },
        },
      ],
    },
    warnings: {
      type: 'array',
      items: { type: 'string' },
    },
    cyclicPaths: {
      type: 'array',
      items: {
        type: 'array',
        items: { type: 'string' },
      },
    },
  },
  $defs: {
    metricValue: {
      anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }, { type: 'null' }],
    },
    metricMap: {
      type: 'object',
      additionalProperties: { $ref: '#/$defs/metricValue' },
    },
    dependencyGraphGroup: {
      type: 'object',
      required: ['id'],
      additionalProperties: {
        anyOf: [
          { type: 'string' },
          { type: 'number' },
          { type: 'boolean' },
          { type: 'null' },
          {
            type: 'array',
            items: { type: 'string' },
          },
          { $ref: '#/$defs/metricMap' },
        ],
      },
      properties: {
        id: { type: 'string' },
        label: { type: 'string' },
        nodeTypes: {
          type: 'array',
          items: { type: 'string' },
        },
        metrics: { $ref: '#/$defs/metricMap' },
      },
    },
  },
} as const;

const ajv = new Ajv({ allErrors: true, strict: true });
const validateDependencyGraph = ajv.compile(dependencyGraphJsonSchema);

export const isDependencyGraph = (value: unknown): value is DependencyGraph =>
  validateDependencyGraph(value) === true;

export const assertDependencyGraph = (value: DependencyGraph): void => {
  if (validateDependencyGraph(value) !== true) {
    throw new Error('plugin-dependency-graph-schema-invalid');
  }
};
