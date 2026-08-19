import type {
  ValidateYamlCanonicalPayloadResult,
  YamlCanonicalValidationError,
} from './yamlCanonicalValidationTypes.js';
import {
  type YamlValidationKernelError,
  yamlValidationKernel,
} from './yamlValidationKernel.internal.js';

function toPublicError(error: YamlValidationKernelError): YamlCanonicalValidationError {
  switch (error.code) {
    case 'REFLECTION_FAILED':
      return {
        code: 'PAYLOAD_ACCESS_FAILED',
        context: { field: 'payload', reason: 'reflection-failure' },
      };
    case 'METADATA_PAYLOAD_NAME_MISMATCH':
    case 'AMBIGUOUS_REGISTRY_TUPLE':
      return { code: 'LEGACY_PAYLOAD', context: { field: 'payload' } };
    default:
      return { code: error.code, context: error.context };
  }
}

/** Validates one canonical filename and payload without accepting legacy shapes. */
export function validateYamlCanonicalPayload(
  filename: unknown,
  payloadValue: unknown
): ValidateYamlCanonicalPayloadResult {
  if (typeof filename !== 'string' || filename.length === 0) {
    return {
      ok: false,
      error: {
        code: 'INVALID_FILENAME',
        context: {
          field: 'filename',
          reason: filename === '' ? 'empty' : 'invalid-type',
        },
      },
    };
  }

  const result = yamlValidationKernel(payloadValue, filename, 'canonical-only');
  if (!result.ok) {
    return { ok: false, error: toPublicError(result.error) };
  }
  if (result.value.classification !== 'canonical') {
    return { ok: false, error: { code: 'LEGACY_PAYLOAD', context: { field: 'payload' } } };
  }
  return { ok: true, value: result.value.payload };
}
