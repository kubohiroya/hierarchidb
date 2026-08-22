import { type ImportValidationIssue, importDataJsonSchema } from '@hierarchidb/import-export-api';
import Ajv, { type ErrorObject } from 'ajv';

const ajv = new Ajv({
  allErrors: true,
  strict: true,
  coerceTypes: false,
  useDefaults: false,
  removeAdditional: false,
});

const validateImportDataSchema = ajv.compile(importDataJsonSchema);

export const validateImportDataPayload = (value: unknown): ImportValidationIssue[] => {
  if (validateImportDataSchema(value) === true) {
    return [];
  }
  return (validateImportDataSchema.errors ?? []).map(toImportValidationIssue);
};

const toImportValidationIssue = (error: ErrorObject): ImportValidationIssue => {
  const path = toIssuePath(error);
  const code = toIssueCode(error);
  return {
    code,
    message: toIssueMessage(error, path),
    path,
  };
};

const toIssueCode = (error: ErrorObject): string => {
  if (
    error.keyword === 'required' &&
    typeof error.params === 'object' &&
    error.params !== null &&
    'missingProperty' in error.params
  ) {
    const missingProperty = error.params.missingProperty;
    if (missingProperty === 'nodes' && error.instancePath === '') {
      return 'INVALID_STRUCTURE';
    }
    if (missingProperty === 'name') {
      return 'MISSING_NAME';
    }
    return `SCHEMA_REQUIRED_${String(missingProperty).toUpperCase()}`;
  }

  if (error.keyword === 'type' && error.instancePath === '/nodes') {
    return 'INVALID_NODES';
  }

  return `SCHEMA_${toUpperSnakeCase(error.keyword)}`;
};

const toIssueMessage = (error: ErrorObject, path: string | undefined): string => {
  if (error.keyword === 'required') {
    const missingProperty =
      typeof error.params === 'object' && error.params !== null && 'missingProperty' in error.params
        ? String(error.params.missingProperty)
        : 'property';
    if (missingProperty === 'nodes' && error.instancePath === '') {
      return 'Import data must contain a nodes array';
    }
    if (missingProperty === 'name') {
      return 'Node name is required';
    }
    return `Required property "${missingProperty}" is missing`;
  }

  if (error.keyword === 'type' && error.instancePath === '/nodes') {
    return 'Nodes must be an array';
  }

  if (error.keyword === 'additionalProperties') {
    const additionalProperty =
      typeof error.params === 'object' &&
      error.params !== null &&
      'additionalProperty' in error.params
        ? String(error.params.additionalProperty)
        : 'unknown';
    return `Unexpected property "${additionalProperty}"${path ? ` at ${path}` : ''}`;
  }

  return error.message ?? 'Import data does not match schema';
};

const toIssuePath = (error: ErrorObject): string | undefined => {
  if (
    error.keyword === 'required' &&
    typeof error.params === 'object' &&
    error.params !== null &&
    'missingProperty' in error.params
  ) {
    return appendPathSegment(error.instancePath, String(error.params.missingProperty));
  }

  if (
    error.keyword === 'additionalProperties' &&
    typeof error.params === 'object' &&
    error.params !== null &&
    'additionalProperty' in error.params
  ) {
    return appendPathSegment(error.instancePath, String(error.params.additionalProperty));
  }

  return jsonPointerToPath(error.instancePath);
};

const appendPathSegment = (basePointer: string, segment: string): string => {
  const basePath = jsonPointerToPath(basePointer);
  const decodedSegment = decodeJsonPointerSegment(segment);
  return basePath ? `${basePath}.${decodedSegment}` : decodedSegment;
};

const jsonPointerToPath = (pointer: string): string | undefined => {
  if (pointer.length === 0) {
    return undefined;
  }

  const segments = pointer
    .split('/')
    .slice(1)
    .map((segment) => decodeJsonPointerSegment(segment));

  return segments.reduce<string>((path, segment) => {
    if (/^(0|[1-9]\d*)$/.test(segment)) {
      return `${path}[${segment}]`;
    }
    return path.length === 0 ? segment : `${path}.${segment}`;
  }, '');
};

const decodeJsonPointerSegment = (segment: string): string =>
  segment.replace(/~1/g, '/').replace(/~0/g, '~');

const toUpperSnakeCase = (value: string): string =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
