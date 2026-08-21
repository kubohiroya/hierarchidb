import { validateYamlCanonicalPayload } from '@hierarchidb/yaml-api/validation';

type OwnValue = Readonly<{ readonly present: boolean; readonly value: unknown }>;

function readOwnValue(record: object, key: PropertyKey): OwnValue | null {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    if (descriptor === undefined) return { present: false, value: undefined };
    if (!Object.hasOwn(descriptor, 'value')) return null;
    return { present: true, value: descriptor.value };
  } catch {
    return null;
  }
}

function isPlainRecord(value: unknown): value is Readonly<Record<PropertyKey, unknown>> {
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;
    return Reflect.ownKeys(value).every((key) => readOwnValue(value, key) !== null);
  } catch {
    return false;
  }
}

function readMetadataName(value: unknown): string | null {
  if (!isPlainRecord(value)) return null;
  const name = readOwnValue(value, 'name');
  return name?.present && typeof name.value === 'string' && name.value.length > 0
    ? name.value
    : null;
}

function isExactEmptyPlainRecord(value: unknown): boolean {
  try {
    return isPlainRecord(value) && Reflect.ownKeys(value).length === 0;
  } catch {
    return false;
  }
}

function isCanonicalSlot(filename: string, payload: unknown): boolean {
  return validateYamlCanonicalPayload(filename, payload).ok;
}

/** Validates the complete YAML TreeNode postimage before a production CoreDB write. */
export function isYamlCanonicalTreeNodePostimage(value: unknown): boolean {
  try {
    if (!isPlainRecord(value)) return false;
    const nodeType = readOwnValue(value, 'nodeType');
    if (nodeType === null || !nodeType.present || nodeType.value !== 'yaml-file') return false;
    const metadata = readOwnValue(value, 'metadata');
    if (metadata === null || !metadata.present) return false;
    const committedName = readMetadataName(metadata.value);
    if (committedName === null) return false;

    const data = readOwnValue(value, 'data');
    const draftMetadata = readOwnValue(value, 'draftMetadata');
    const draftData = readOwnValue(value, 'draftData');
    const isTemporary = readOwnValue(value, 'isTemporary');
    if (data === null || draftMetadata === null || draftData === null || isTemporary === null) {
      return false;
    }

    const draftMetadataPresent =
      draftMetadata.present && draftMetadata.value !== undefined && draftMetadata.value !== null;
    const draftName = draftMetadataPresent ? readMetadataName(draftMetadata.value) : null;
    if (draftMetadataPresent && draftName === null) return false;
    const draftDataPresent = draftData.present && draftData.value !== undefined;
    const committedPresent = data.present && data.value !== undefined && data.value !== null;

    const placeholder =
      isTemporary.present &&
      isTemporary.value === true &&
      data.present &&
      data.value === null &&
      draftName !== null &&
      draftData.present &&
      isExactEmptyPlainRecord(draftData.value);
    if (placeholder) return true;

    if (!committedPresent) {
      return (
        draftName !== null &&
        draftDataPresent &&
        !isExactEmptyPlainRecord(draftData.value) &&
        isCanonicalSlot(draftName, draftData.value)
      );
    }
    if (!isCanonicalSlot(committedName, data.value)) return false;

    if (!draftMetadataPresent && !draftDataPresent) return true;
    if (draftName !== null && !draftDataPresent) return draftName === committedName;
    if (draftName === null || !draftDataPresent) return false;
    return isCanonicalSlot(draftName, draftData.value);
  } catch {
    return false;
  }
}

export function assertYamlCanonicalTreeNodePostimage(value: unknown): void {
  if (!isYamlCanonicalTreeNodePostimage(value)) {
    throw new Error('yaml-canonical-tree-node-postimage-required');
  }
}
