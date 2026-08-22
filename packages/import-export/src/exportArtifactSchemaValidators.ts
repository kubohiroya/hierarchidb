import type { NodeId } from '@hierarchidb/core-types';
import type { ExportNodesParams } from '@hierarchidb/import-export-api';
import Ajv, { type ValidateFunction } from 'ajv';

type ExportFormat = ExportNodesParams['format'];

export interface JsonExportEnvelopeNode {
  readonly name: string;
  readonly nodeType: string;
  readonly description: string;
}

export interface JsonExportEnvelope {
  readonly version: '1.0';
  readonly exportDate: string;
  readonly nodeCount: number;
  readonly nodes: readonly JsonExportEnvelopeNode[];
}

export interface VectorTileArchiveSummary {
  readonly exportDate: string;
  readonly nodeCount: number;
  readonly tileCount: number;
  readonly format: Extract<ExportFormat, 'pbf.zip' | 'mvf'>;
  readonly includeMetadata: boolean;
  readonly totalBytes: number;
  readonly nodeIds: readonly NodeId[];
}

export interface VectorTileArchiveMetadata {
  readonly format: 'vector-tile-export';
  readonly summary: VectorTileArchiveSummary;
}

export type ExportArtifactKind =
  | 'json-export-envelope'
  | 'vector-tile-archive-summary'
  | 'vector-tile-archive-metadata';

export class ExportArtifactValidationError extends Error {
  readonly code = 'EXPORT_ARTIFACT_SCHEMA_INVALID';
  readonly artifact: ExportArtifactKind;

  constructor(artifact: ExportArtifactKind) {
    super(`EXPORT_ARTIFACT_SCHEMA_INVALID:${artifact}`);
    this.name = 'ExportArtifactValidationError';
    this.artifact = artifact;
  }
}

const isoDateTimePattern = '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$';

export const jsonExportEnvelopeSchema = {
  $id: 'https://hierarchidb.dev/schemas/import-export/json-export-envelope.json',
  type: 'object',
  required: ['version', 'exportDate', 'nodeCount', 'nodes'],
  additionalProperties: false,
  properties: {
    version: { const: '1.0' },
    exportDate: { type: 'string', pattern: isoDateTimePattern },
    nodeCount: { type: 'integer', minimum: 0 },
    nodes: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'nodeType', 'description'],
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          nodeType: { type: 'string', minLength: 1 },
          description: { type: 'string' },
        },
      },
    },
  },
} as const;

export const vectorTileArchiveSummarySchema = {
  $id: 'https://hierarchidb.dev/schemas/import-export/vector-tile-archive-summary.json',
  type: 'object',
  required: [
    'exportDate',
    'nodeCount',
    'tileCount',
    'format',
    'includeMetadata',
    'totalBytes',
    'nodeIds',
  ],
  additionalProperties: false,
  properties: {
    exportDate: { type: 'string', pattern: isoDateTimePattern },
    nodeCount: { type: 'integer', minimum: 0 },
    tileCount: { type: 'integer', minimum: 0 },
    format: { enum: ['pbf.zip', 'mvf'] },
    includeMetadata: { type: 'boolean' },
    totalBytes: { type: 'integer', minimum: 0 },
    nodeIds: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
    },
  },
} as const;

export const vectorTileArchiveMetadataSchema = {
  $id: 'https://hierarchidb.dev/schemas/import-export/vector-tile-archive-metadata.json',
  type: 'object',
  required: ['format', 'summary'],
  additionalProperties: false,
  properties: {
    format: { const: 'vector-tile-export' },
    summary: { $ref: vectorTileArchiveSummarySchema.$id },
  },
} as const;

const ajv = new Ajv({
  strict: true,
  allErrors: true,
  coerceTypes: false,
  useDefaults: false,
  removeAdditional: false,
});

ajv.addSchema(vectorTileArchiveSummarySchema);

const validators: Record<ExportArtifactKind, ValidateFunction> = {
  'json-export-envelope': ajv.compile(jsonExportEnvelopeSchema),
  'vector-tile-archive-summary':
    ajv.getSchema(vectorTileArchiveSummarySchema.$id) ??
    ajv.compile(vectorTileArchiveSummarySchema),
  'vector-tile-archive-metadata': ajv.compile(vectorTileArchiveMetadataSchema),
};

export function assertJsonExportEnvelope(value: unknown): asserts value is JsonExportEnvelope {
  assertExportArtifact('json-export-envelope', value);
  const envelope = value as JsonExportEnvelope;
  if (envelope.nodeCount !== envelope.nodes.length) {
    throw new ExportArtifactValidationError('json-export-envelope');
  }
}

export function assertVectorTileArchiveSummary(
  value: unknown
): asserts value is VectorTileArchiveSummary {
  assertExportArtifact('vector-tile-archive-summary', value);
  const summary = value as VectorTileArchiveSummary;
  if (summary.nodeCount !== summary.nodeIds.length) {
    throw new ExportArtifactValidationError('vector-tile-archive-summary');
  }
}

export function assertVectorTileArchiveMetadata(
  value: unknown
): asserts value is VectorTileArchiveMetadata {
  assertExportArtifact('vector-tile-archive-metadata', value);
  const metadata = value as VectorTileArchiveMetadata;
  assertVectorTileArchiveSummary(metadata.summary);
}

function assertExportArtifact(artifact: ExportArtifactKind, value: unknown): void {
  const validator = validators[artifact];
  if (validator(value) !== true) {
    throw new ExportArtifactValidationError(artifact);
  }
}
