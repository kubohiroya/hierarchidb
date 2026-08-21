import { toNodeId } from '@hierarchidb/core-types';
import { validateYamlCanonicalPayload } from '@hierarchidb/yaml-api/validation';
import type {
  YamlCanonicalDialogWritePort,
  YamlCanonicalDialogWriterError,
  YamlCanonicalDialogWriterInput,
  YamlCanonicalDialogWriterInputField,
  YamlCanonicalDialogWriterInputReason,
  YamlCanonicalDialogWriterResult,
} from './yamlCanonicalDialogWriterTypes.js';

const INPUT_KEYS = ['nodeId', 'mode', 'filename', 'description', 'tags', 'payload'] as const;
const INPUT_KEY_SET = new Set<PropertyKey>(INPUT_KEYS);

type InputKey = (typeof INPUT_KEYS)[number];

type ParseInputResult =
  | Readonly<{ readonly ok: true; readonly value: YamlCanonicalDialogWriterInput }>
  | Readonly<{ readonly ok: false; readonly error: YamlCanonicalDialogWriterError }>;

function invalidInput(
  field: YamlCanonicalDialogWriterInputField,
  reason: YamlCanonicalDialogWriterInputReason
): YamlCanonicalDialogWriterError {
  return { code: 'INVALID_INPUT', context: { field, reason } };
}

function isPlainRecord(value: unknown): value is Readonly<Record<PropertyKey, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function dataDescriptorValue(
  record: Readonly<Record<PropertyKey, unknown>>,
  key: InputKey
): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  return descriptor?.value;
}

function parseTags(
  value: unknown
):
  | Readonly<{ readonly ok: true; readonly value: readonly string[] }>
  | Readonly<{ readonly ok: false; readonly error: YamlCanonicalDialogWriterError }> {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    return { ok: false, error: invalidInput('tags', 'invalid-type') };
  }

  const ownKeys = Reflect.ownKeys(value);
  if (
    ownKeys.some((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return descriptor === undefined || !Object.hasOwn(descriptor, 'value');
    })
  ) {
    return { ok: false, error: invalidInput('tags', 'accessor-property') };
  }

  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
  const length = lengthDescriptor?.value;
  if (!Number.isSafeInteger(length) || typeof length !== 'number' || length < 0) {
    return { ok: false, error: invalidInput('tags', 'invalid-type') };
  }

  const expectedKeys = new Set<PropertyKey>(['length']);
  for (let index = 0; index < length; index += 1) expectedKeys.add(String(index));
  if (ownKeys.length !== expectedKeys.size || ownKeys.some((key) => !expectedKeys.has(key))) {
    return { ok: false, error: invalidInput('tags', 'unexpected-field') };
  }

  const tags: string[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined || !Object.hasOwn(descriptor, 'value')) {
      return { ok: false, error: invalidInput('tags', 'missing') };
    }
    if (typeof descriptor.value !== 'string') {
      return { ok: false, error: invalidInput('tags', 'invalid-item') };
    }
    tags.push(descriptor.value);
  }
  return { ok: true, value: tags };
}

function parseInputUnsafe(inputValue: unknown): ParseInputResult {
  if (!isPlainRecord(inputValue)) {
    return { ok: false, error: invalidInput('input', 'invalid-type') };
  }

  const ownKeys = Reflect.ownKeys(inputValue);
  if (
    ownKeys.some((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(inputValue, key);
      return descriptor === undefined || !Object.hasOwn(descriptor, 'value');
    })
  ) {
    return { ok: false, error: invalidInput('input', 'accessor-property') };
  }
  if (ownKeys.some((key) => !INPUT_KEY_SET.has(key))) {
    return { ok: false, error: invalidInput('input', 'unexpected-field') };
  }

  for (const key of INPUT_KEYS) {
    if (!Object.hasOwn(inputValue, key)) {
      return { ok: false, error: invalidInput(key, 'missing') };
    }
    if (dataDescriptorValue(inputValue, key) === undefined) {
      return { ok: false, error: invalidInput(key, 'undefined') };
    }
  }

  const nodeIdValue = dataDescriptorValue(inputValue, 'nodeId');
  if (typeof nodeIdValue !== 'string') {
    return { ok: false, error: invalidInput('nodeId', 'invalid-type') };
  }
  if (nodeIdValue.length === 0) {
    return { ok: false, error: invalidInput('nodeId', 'empty') };
  }

  const modeValue = dataDescriptorValue(inputValue, 'mode');
  if (modeValue !== 'save-draft' && modeValue !== 'save') {
    return { ok: false, error: invalidInput('mode', 'invalid-value') };
  }

  const filenameValue = dataDescriptorValue(inputValue, 'filename');
  if (typeof filenameValue !== 'string') {
    return { ok: false, error: invalidInput('filename', 'invalid-type') };
  }

  const descriptionValue = dataDescriptorValue(inputValue, 'description');
  if (typeof descriptionValue !== 'string') {
    return { ok: false, error: invalidInput('description', 'invalid-type') };
  }

  const tagsResult = parseTags(dataDescriptorValue(inputValue, 'tags'));
  if (!tagsResult.ok) return tagsResult;

  return {
    ok: true,
    value: {
      nodeId: toNodeId(nodeIdValue),
      mode: modeValue,
      filename: filenameValue,
      description: descriptionValue,
      tags: tagsResult.value,
      payload: dataDescriptorValue(inputValue, 'payload'),
    },
  };
}

function parseInput(inputValue: unknown): ParseInputResult {
  try {
    return parseInputUnsafe(inputValue);
  } catch {
    return { ok: false, error: invalidInput('input', 'reflection-failure') };
  }
}

/** Validates and emits one canonical YAML dialog write request. */
export async function writeYamlCanonicalDialogDraft(
  inputValue: unknown,
  writePort: YamlCanonicalDialogWritePort
): Promise<YamlCanonicalDialogWriterResult> {
  if (typeof writePort !== 'function') {
    return { ok: false, error: invalidInput('writePort', 'invalid-type') };
  }

  const inputResult = parseInput(inputValue);
  if (!inputResult.ok) return inputResult;

  const input = inputResult.value;
  const validationResult = validateYamlCanonicalPayload(input.filename, input.payload);
  if (!validationResult.ok) {
    return {
      ok: false,
      error: {
        code: 'CANONICAL_VALIDATION_FAILED',
        validationError: validationResult.error,
      },
    };
  }

  const request = {
    nodeId: input.nodeId,
    mode: input.mode,
    draftMetadata: {
      name: input.filename,
      description: input.description,
      tags: [...input.tags],
    },
    draftData: validationResult.value,
    onNameConflict: 'error',
  } as const;

  try {
    await writePort(request);
  } catch {
    return { ok: false, error: { code: 'WRITE_PORT_FAILED' } };
  }
  return { ok: true };
}
