type PlainRecord = Record<PropertyKey, unknown>;

type SelectYamlStorageRawNodesResult =
  | Readonly<{ readonly ok: true; readonly rawYamlNodes: readonly unknown[] }>
  | Readonly<{ readonly ok: false }>;

function isPlainRecord(value: unknown): value is PlainRecord {
  if (value === null || typeof value !== 'object') return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function readOwnDataProperty(
  record: PlainRecord,
  key: PropertyKey
):
  | Readonly<{ readonly ok: true; readonly present: boolean; readonly value?: unknown }>
  | Readonly<{ readonly ok: false }> {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    if (descriptor === undefined) return Object.freeze({ ok: true, present: false });
    if (!Object.hasOwn(descriptor, 'value')) return Object.freeze({ ok: false });
    return Object.freeze({ ok: true, present: true, value: descriptor.value });
  } catch {
    return Object.freeze({ ok: false });
  }
}

function ownDataValuesMatch(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (!isPlainRecord(left) || !isPlainRecord(right)) return false;
  try {
    const leftKeys = Reflect.ownKeys(left);
    const rightKeys = Reflect.ownKeys(right);
    if (leftKeys.length !== rightKeys.length) return false;
    for (const key of leftKeys) {
      if (!rightKeys.includes(key)) return false;
      const leftProperty = readOwnDataProperty(left, key);
      const rightProperty = readOwnDataProperty(right, key);
      if (
        !leftProperty.ok ||
        !rightProperty.ok ||
        !leftProperty.present ||
        !rightProperty.present ||
        !ownDataValuesMatch(leftProperty.value, rightProperty.value)
      ) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

function selectedFieldsMatch(left: PlainRecord, right: PlainRecord): boolean {
  for (const key of ['id', 'nodeType', 'version', 'isTemporary', 'data', 'draftData'] as const) {
    const leftProperty = readOwnDataProperty(left, key);
    const rightProperty = readOwnDataProperty(right, key);
    if (
      !leftProperty.ok ||
      !rightProperty.ok ||
      leftProperty.present !== rightProperty.present ||
      (leftProperty.present && !ownDataValuesMatch(leftProperty.value, rightProperty.value))
    ) {
      return false;
    }
  }

  for (const key of ['metadata', 'draftMetadata'] as const) {
    const leftProperty = readOwnDataProperty(left, key);
    const rightProperty = readOwnDataProperty(right, key);
    if (!leftProperty.ok || !rightProperty.ok || leftProperty.present !== rightProperty.present) {
      return false;
    }
    if (!leftProperty.present) continue;
    if (leftProperty.value === null || rightProperty.value === null) {
      if (leftProperty.value !== rightProperty.value) return false;
      continue;
    }
    if (!isPlainRecord(leftProperty.value) || !isPlainRecord(rightProperty.value)) return false;
    const leftName = readOwnDataProperty(leftProperty.value, 'name');
    const rightName = readOwnDataProperty(rightProperty.value, 'name');
    if (
      !leftName.ok ||
      !rightName.ok ||
      leftName.present !== rightName.present ||
      (leftName.present && !Object.is(leftName.value, rightName.value))
    ) {
      return false;
    }
  }
  return true;
}

function getNodeId(value: unknown): string | null {
  if (!isPlainRecord(value)) return null;
  const property = readOwnDataProperty(value, 'id');
  return property.ok &&
    property.present &&
    typeof property.value === 'string' &&
    property.value.length > 0
    ? property.value
    : null;
}

export function selectYamlStorageRawNodes(
  rawNodes: readonly unknown[]
): SelectYamlStorageRawNodesResult {
  const selected: unknown[] = [];
  try {
    for (let index = 0; index < rawNodes.length; index += 1) {
      const arrayProperty = Object.getOwnPropertyDescriptor(rawNodes, String(index));
      if (arrayProperty === undefined || !Object.hasOwn(arrayProperty, 'value')) {
        return Object.freeze({ ok: false });
      }
      const rawNode = arrayProperty.value;
      if (!isPlainRecord(rawNode)) return Object.freeze({ ok: false });
      const nodeType = readOwnDataProperty(rawNode, 'nodeType');
      if (!nodeType.ok) return Object.freeze({ ok: false });
      if (nodeType.present && nodeType.value === 'yaml-file') selected.push(rawNode);
    }
  } catch {
    return Object.freeze({ ok: false });
  }
  return Object.freeze({ ok: true, rawYamlNodes: Object.freeze(selected) });
}

export function yamlStorageRawSnapshotsMatch(
  preflightNodes: readonly unknown[],
  versionchangeNodes: readonly unknown[]
): boolean {
  if (preflightNodes.length !== versionchangeNodes.length) return false;
  const preflightById = new Map<string, PlainRecord>();
  for (const rawNode of preflightNodes) {
    const nodeId = getNodeId(rawNode);
    if (nodeId === null || preflightById.has(nodeId) || !isPlainRecord(rawNode)) return false;
    preflightById.set(nodeId, rawNode);
  }
  const seen = new Set<string>();
  for (const rawNode of versionchangeNodes) {
    const nodeId = getNodeId(rawNode);
    if (nodeId === null || seen.has(nodeId) || !isPlainRecord(rawNode)) return false;
    const preflightNode = preflightById.get(nodeId);
    if (preflightNode === undefined || !selectedFieldsMatch(preflightNode, rawNode)) return false;
    seen.add(nodeId);
  }
  return seen.size === preflightById.size;
}

export function cloneYamlStorageRawNode(rawNode: unknown): PlainRecord | null {
  if (!isPlainRecord(rawNode)) return null;
  try {
    const descriptors = Object.getOwnPropertyDescriptors(rawNode);
    if (Reflect.ownKeys(descriptors).some((key) => !Object.hasOwn(descriptors[key], 'value'))) {
      return null;
    }
    return Object.defineProperties({}, descriptors) as PlainRecord;
  } catch {
    return null;
  }
}
