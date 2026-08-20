import type { ValidatedYamlCanonicalPayload } from '@hierarchidb/yaml-api/validation';
import type {
  CanonicalYamlZipExportSlot,
  CanonicalYamlZipNodeGuard,
  CanonicalYamlZipPlanError,
  CanonicalYamlZipPlanInputField,
  CanonicalYamlZipPlanInputReason,
  CanonicalYamlZipSiblingGuard,
} from './canonicalYamlZipPlanTypes.js';

type OwnProperty =
  | Readonly<{ readonly kind: 'missing' }>
  | Readonly<{ readonly kind: 'data'; readonly value: unknown }>
  | Readonly<{ readonly kind: 'accessor' }>;

interface ParsedMetadata {
  readonly name: string;
}

interface ParsedYamlNode {
  readonly sourceIndex: number;
  readonly id: string;
  readonly parentId: string;
  readonly nodeType: string;
  readonly depth: number;
  readonly version: number;
  readonly metadata: ParsedMetadata;
  readonly draftMetadata: ParsedMetadata | null;
  readonly data: unknown;
  readonly draftData: unknown | undefined;
  readonly hasChildren: boolean | undefined;
}

interface ParsedExportInput {
  readonly slot: CanonicalYamlZipExportSlot;
  readonly nodes: readonly ParsedYamlNode[];
}

interface ParsedImportInput {
  readonly archive: string | Uint8Array;
  readonly parent: ParsedYamlNode;
  readonly siblings: readonly ParsedYamlNode[];
  readonly existingNodeIds: readonly string[];
  readonly generatedNodeIds: readonly string[];
  readonly timestamp: number;
}

type ParseResult<T> =
  | Readonly<{ readonly ok: true; readonly value: T }>
  | Readonly<{ readonly ok: false; readonly errors: readonly CanonicalYamlZipPlanError[] }>;

const TREE_NODE_KEYS = new Set<PropertyKey>([
  'id',
  'parentId',
  'nodeType',
  'depth',
  'createdAt',
  'updatedAt',
  'version',
  'metadata',
  'draftMetadata',
  'data',
  'draftData',
  'isTemporary',
  'visible',
  'dialogUIState',
  'hasChildren',
  'descendantCount',
  'isEstimated',
  'references',
  'originalName',
  'originalParentId',
  'removedAt',
  'lastTouchedAt',
  'map',
  'viewProperties',
]);

const REQUIRED_TREE_NODE_KEYS = [
  'id',
  'parentId',
  'nodeType',
  'depth',
  'createdAt',
  'updatedAt',
  'version',
  'metadata',
  'draftMetadata',
  'data',
  'visible',
] as const;

const METADATA_KEYS = new Set<PropertyKey>(['name', 'description', 'tags', 'buildMetadata']);
const EXPORT_INPUT_KEYS = ['slot', 'nodes'] as const;
const IMPORT_INPUT_KEYS = [
  'archive',
  'parent',
  'siblings',
  'existingNodeIds',
  'generatedNodeIds',
  'timestamp',
] as const;

function error(
  field: CanonicalYamlZipPlanInputField,
  reason: CanonicalYamlZipPlanInputReason,
  sourceIndex?: number
): CanonicalYamlZipPlanError {
  return Object.freeze({
    code: 'INVALID_INPUT',
    context: Object.freeze({
      field,
      reason,
      ...(sourceIndex === undefined ? {} : { sourceIndex }),
    }),
  });
}

function failure<T>(errors: readonly CanonicalYamlZipPlanError[]): ParseResult<T> {
  return Object.freeze({ ok: false, errors: Object.freeze([...errors]) });
}

function isPlainRecord(value: unknown): value is Readonly<Record<PropertyKey, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function readOwnProperty(
  value: Readonly<Record<PropertyKey, unknown>>,
  property: PropertyKey
): OwnProperty {
  const descriptor = Object.getOwnPropertyDescriptor(value, property);
  if (descriptor === undefined) return { kind: 'missing' };
  if (!Object.hasOwn(descriptor, 'value')) return { kind: 'accessor' };
  return { kind: 'data', value: descriptor.value };
}

function readExactObject(
  value: unknown,
  expectedKeys: readonly string[],
  field: 'input'
):
  | Readonly<{ readonly ok: true; readonly values: Readonly<Record<string, unknown>> }>
  | Readonly<{ readonly ok: false; readonly error: CanonicalYamlZipPlanError }> {
  try {
    if (!isPlainRecord(value)) {
      return { ok: false, error: error(field, value === null ? 'null' : 'invalid-type') };
    }
    const expected = new Set<PropertyKey>(expectedKeys);
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length !== expectedKeys.length || ownKeys.some((key) => !expected.has(key))) {
      return { ok: false, error: error(field, 'unexpected-field') };
    }
    const values: Record<string, unknown> = {};
    for (const key of expectedKeys) {
      const property = readOwnProperty(value, key);
      if (property.kind !== 'data') {
        return {
          ok: false,
          error: error(field, property.kind === 'missing' ? 'missing' : 'accessor-property'),
        };
      }
      values[key] = property.value;
    }
    return { ok: true, values: Object.freeze(values) };
  } catch {
    return { ok: false, error: error(field, 'reflection-failure') };
  }
}

function readStrictArray(
  value: unknown,
  field: 'nodes' | 'siblings' | 'existingNodeIds' | 'generatedNodeIds'
):
  | Readonly<{ readonly ok: true; readonly value: readonly unknown[] }>
  | Readonly<{ readonly ok: false; readonly error: CanonicalYamlZipPlanError }> {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
      return { ok: false, error: error(field, 'invalid-type') };
    }
    const ownKeys = Reflect.ownKeys(value);
    const allowed = new Set<PropertyKey>(['length']);
    for (let index = 0; index < value.length; index += 1) allowed.add(String(index));
    if (ownKeys.length !== allowed.size || ownKeys.some((key) => !allowed.has(key))) {
      return { ok: false, error: error(field, 'invalid-item') };
    }
    const values: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const property = Object.getOwnPropertyDescriptor(value, String(index));
      if (property === undefined || !Object.hasOwn(property, 'value')) {
        return { ok: false, error: error(field, 'accessor-property', index) };
      }
      values.push(property.value);
    }
    return { ok: true, value: Object.freeze(values) };
  } catch {
    return { ok: false, error: error(field, 'reflection-failure') };
  }
}

function parseMetadata(
  value: unknown,
  field: 'metadata' | 'draftMetadata',
  sourceIndex: number
): ParseResult<ParsedMetadata> {
  try {
    if (!isPlainRecord(value)) return failure([error(field, 'invalid-type', sourceIndex)]);
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.some((key) => !METADATA_KEYS.has(key))) {
      return failure([error(field, 'unexpected-field', sourceIndex)]);
    }
    for (const required of ['name', 'description', 'tags'] as const) {
      const property = readOwnProperty(value, required);
      if (property.kind !== 'data') {
        return failure([
          error(field, property.kind === 'missing' ? 'missing' : 'accessor-property', sourceIndex),
        ]);
      }
    }
    for (const key of ownKeys) {
      if (readOwnProperty(value, key).kind === 'accessor') {
        return failure([error(field, 'accessor-property', sourceIndex)]);
      }
    }
    const name = readOwnProperty(value, 'name');
    const description = readOwnProperty(value, 'description');
    const tags = readOwnProperty(value, 'tags');
    if (
      name.kind !== 'data' ||
      typeof name.value !== 'string' ||
      name.value.length === 0 ||
      description.kind !== 'data' ||
      typeof description.value !== 'string'
    ) {
      return failure([error(field, 'invalid-value', sourceIndex)]);
    }
    const tagArray = readStrictArray(tags.kind === 'data' ? tags.value : undefined, 'nodes');
    if (!tagArray.ok || tagArray.value.some((tag) => typeof tag !== 'string')) {
      return failure([error(field, 'invalid-value', sourceIndex)]);
    }
    return { ok: true, value: Object.freeze({ name: name.value }) };
  } catch {
    return failure([error(field, 'reflection-failure', sourceIndex)]);
  }
}

function parseYamlNode(value: unknown, sourceIndex: number): ParseResult<ParsedYamlNode> {
  try {
    if (!isPlainRecord(value)) return failure([error('node', 'invalid-type', sourceIndex)]);
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.some((key) => !TREE_NODE_KEYS.has(key))) {
      return failure([error('node', 'unexpected-field', sourceIndex)]);
    }
    for (const required of REQUIRED_TREE_NODE_KEYS) {
      const property = readOwnProperty(value, required);
      if (property.kind !== 'data') {
        return failure([
          error('node', property.kind === 'missing' ? 'missing' : 'accessor-property', sourceIndex),
        ]);
      }
    }
    for (const key of ownKeys) {
      if (readOwnProperty(value, key).kind === 'accessor') {
        return failure([error('node', 'accessor-property', sourceIndex)]);
      }
    }
    const id = readOwnProperty(value, 'id');
    const parentId = readOwnProperty(value, 'parentId');
    const nodeType = readOwnProperty(value, 'nodeType');
    const depth = readOwnProperty(value, 'depth');
    const createdAt = readOwnProperty(value, 'createdAt');
    const updatedAt = readOwnProperty(value, 'updatedAt');
    const version = readOwnProperty(value, 'version');
    const visible = readOwnProperty(value, 'visible');
    if (id.kind !== 'data' || typeof id.value !== 'string' || id.value.length === 0) {
      return failure([error('id', 'invalid-value', sourceIndex)]);
    }
    if (
      parentId.kind !== 'data' ||
      typeof parentId.value !== 'string' ||
      parentId.value.length === 0
    ) {
      return failure([error('parentId', 'invalid-value', sourceIndex)]);
    }
    if (nodeType.kind !== 'data' || typeof nodeType.value !== 'string') {
      return failure([error('nodeType', 'invalid-value', sourceIndex)]);
    }
    if (
      depth.kind !== 'data' ||
      typeof depth.value !== 'number' ||
      !Number.isSafeInteger(depth.value) ||
      depth.value < 0
    ) {
      return failure([error('depth', 'invalid-value', sourceIndex)]);
    }
    if (
      version.kind !== 'data' ||
      typeof version.value !== 'number' ||
      !Number.isSafeInteger(version.value) ||
      version.value < 0
    ) {
      return failure([error('version', 'invalid-value', sourceIndex)]);
    }
    for (const timestampProperty of [createdAt, updatedAt]) {
      if (
        timestampProperty.kind !== 'data' ||
        typeof timestampProperty.value !== 'number' ||
        !Number.isSafeInteger(timestampProperty.value) ||
        timestampProperty.value < 0
      ) {
        return failure([error('node', 'invalid-value', sourceIndex)]);
      }
    }
    if (visible.kind !== 'data' || typeof visible.value !== 'boolean') {
      return failure([error('node', 'invalid-value', sourceIndex)]);
    }
    const metadataProperty = readOwnProperty(value, 'metadata');
    const metadata = parseMetadata(
      metadataProperty.kind === 'data' ? metadataProperty.value : undefined,
      'metadata',
      sourceIndex
    );
    if (!metadata.ok) return metadata;
    const draftMetadataProperty = readOwnProperty(value, 'draftMetadata');
    let draftMetadata: ParsedMetadata | null = null;
    if (draftMetadataProperty.kind === 'data' && draftMetadataProperty.value !== null) {
      const parsedDraftMetadata = parseMetadata(
        draftMetadataProperty.value,
        'draftMetadata',
        sourceIndex
      );
      if (!parsedDraftMetadata.ok) return parsedDraftMetadata;
      draftMetadata = parsedDraftMetadata.value;
    }
    const data = readOwnProperty(value, 'data');
    const draftData = readOwnProperty(value, 'draftData');
    const hasChildren = readOwnProperty(value, 'hasChildren');
    if (
      hasChildren.kind === 'data' &&
      hasChildren.value !== undefined &&
      typeof hasChildren.value !== 'boolean'
    ) {
      return failure([error('hasChildren', 'invalid-value', sourceIndex)]);
    }
    return {
      ok: true,
      value: Object.freeze({
        sourceIndex,
        id: id.value,
        parentId: parentId.value,
        nodeType: nodeType.value,
        depth: depth.value,
        version: version.value,
        metadata: metadata.value,
        draftMetadata,
        data: data.kind === 'data' ? data.value : undefined,
        draftData: draftData.kind === 'data' ? draftData.value : undefined,
        hasChildren:
          hasChildren.kind === 'data' && typeof hasChildren.value === 'boolean'
            ? hasChildren.value
            : undefined,
      }),
    };
  } catch {
    return failure([error('node', 'reflection-failure', sourceIndex)]);
  }
}

function parseNodeArray(
  value: unknown,
  field: 'nodes' | 'siblings'
): ParseResult<readonly ParsedYamlNode[]> {
  const array = readStrictArray(value, field);
  if (!array.ok) return failure([array.error]);
  const nodes: ParsedYamlNode[] = [];
  const ids = new Set<string>();
  for (let index = 0; index < array.value.length; index += 1) {
    const parsed = parseYamlNode(array.value[index], index);
    if (!parsed.ok) return parsed;
    if (ids.has(parsed.value.id)) return failure([error('id', 'duplicate', index)]);
    ids.add(parsed.value.id);
    nodes.push(parsed.value);
  }
  return { ok: true, value: Object.freeze(nodes) };
}

function parseStringArray(
  value: unknown,
  field: 'existingNodeIds' | 'generatedNodeIds'
): ParseResult<readonly string[]> {
  const array = readStrictArray(value, field);
  if (!array.ok) return failure([array.error]);
  const strings: string[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < array.value.length; index += 1) {
    const item = array.value[index];
    if (typeof item !== 'string' || item.length === 0) {
      return failure([error(field, 'invalid-item', index)]);
    }
    if (seen.has(item)) return failure([error(field, 'duplicate', index)]);
    seen.add(item);
    strings.push(item);
  }
  return { ok: true, value: Object.freeze(strings) };
}

function parseExportInput(input: unknown): ParseResult<ParsedExportInput> {
  const strict = readExactObject(input, EXPORT_INPUT_KEYS, 'input');
  if (!strict.ok) return failure([strict.error]);
  const slot = strict.values.slot;
  if (slot !== 'committed' && slot !== 'draft') {
    return failure([error('slot', 'invalid-value')]);
  }
  const nodes = parseNodeArray(strict.values.nodes, 'nodes');
  if (!nodes.ok) return nodes;
  if (nodes.value.length === 0) return failure([error('nodes', 'empty')]);
  return { ok: true, value: Object.freeze({ slot, nodes: nodes.value }) };
}

function parseImportInput(input: unknown): ParseResult<ParsedImportInput> {
  const strict = readExactObject(input, IMPORT_INPUT_KEYS, 'input');
  if (!strict.ok) return failure([strict.error]);
  const archive = strict.values.archive;
  try {
    if (!(typeof archive === 'string' || archive instanceof Uint8Array)) {
      return failure([error('archive', 'invalid-type')]);
    }
  } catch {
    return failure([error('archive', 'reflection-failure')]);
  }
  const parent = parseYamlNode(strict.values.parent, 0);
  if (!parent.ok) return parent;
  const siblings = parseNodeArray(strict.values.siblings, 'siblings');
  if (!siblings.ok) return siblings;
  const existingNodeIds = parseStringArray(strict.values.existingNodeIds, 'existingNodeIds');
  if (!existingNodeIds.ok) return existingNodeIds;
  const generatedNodeIds = parseStringArray(strict.values.generatedNodeIds, 'generatedNodeIds');
  if (!generatedNodeIds.ok) return generatedNodeIds;
  const timestamp = strict.values.timestamp;
  if (typeof timestamp !== 'number' || !Number.isSafeInteger(timestamp) || timestamp < 0) {
    return failure([error('timestamp', 'invalid-value')]);
  }
  return {
    ok: true,
    value: Object.freeze({
      archive,
      parent: parent.value,
      siblings: siblings.value,
      existingNodeIds: existingNodeIds.value,
      generatedNodeIds: generatedNodeIds.value,
      timestamp,
    }),
  };
}

function nodeGuard(node: ParsedYamlNode): CanonicalYamlZipNodeGuard {
  return Object.freeze({
    sourceIndex: node.sourceIndex,
    nodeId: node.id,
    expectedVersion: node.version,
  });
}

function siblingGuard(node: ParsedYamlNode): CanonicalYamlZipSiblingGuard {
  return Object.freeze({
    ...nodeGuard(node),
    parentId: node.parentId,
    metadataName: node.metadata.name,
  });
}

function freezeCanonicalPayload(
  payload: ValidatedYamlCanonicalPayload
): ValidatedYamlCanonicalPayload {
  return Object.freeze({
    subtype: payload.subtype,
    schemaId: payload.schemaId,
    content: payload.content,
  });
}

export const canonicalYamlZipPlanGuards = Object.freeze({
  error,
  failure,
  freezeCanonicalPayload,
  nodeGuard,
  parseExportInput,
  parseImportInput,
  siblingGuard,
});

export type { ParsedImportInput, ParsedYamlNode };
