import { digestSha256Hex, getBuildDatabasePrefix, getDBName } from '@hierarchidb/util';
import { YAML_SUBTYPE_REGISTRY, type YamlSubtype } from '@hierarchidb/yaml-api';
import { validateYamlCanonicalPayload } from '@hierarchidb/yaml-api/validation';

const LEGACY_YAMLDB_INVENTORY_CONTRACT_VERSION = 1 as const;
const LEGACY_YAMLDB_NATIVE_VERSION = 1;
const LEGACY_YAMLDB_OBJECT_STORE_NAME = 'nodes';
const LEGACY_YAMLDB_ROW_KEYS = ['content', 'name', 'nodeId', 'parentId', 'schemaId'] as const;
const textEncoder = new TextEncoder();

type LegacyYamlDbInventoryStatus = 'accepted' | 'missing' | 'failed';

export type LegacyYamlDbInventoryErrorCode =
  | 'DATABASE_INFO_UNAVAILABLE'
  | 'LEGACY_YAMLDB_MISSING'
  | 'LEGACY_YAMLDB_DUPLICATE_INFO'
  | 'LEGACY_YAMLDB_VERSION_MISMATCH'
  | 'LEGACY_YAMLDB_OPEN_BLOCKED'
  | 'LEGACY_YAMLDB_UNEXPECTED_UPGRADE'
  | 'LEGACY_YAMLDB_OPEN_FAILED'
  | 'LEGACY_YAMLDB_TOPOLOGY_MALFORMED'
  | 'LEGACY_YAMLDB_READ_FAILED'
  | 'LEGACY_YAMLDB_DIGEST_FAILED';

export type LegacyYamlDbInventoryInvalidCode =
  | 'ROW_NOT_PLAIN_OBJECT'
  | 'ROW_UNSAFE_PROPERTY'
  | 'ROW_UNKNOWN_FIELD'
  | 'ROW_MISSING_FIELD'
  | 'ROW_INVALID_FIELD'
  | 'PRIMARY_KEY_MISMATCH'
  | 'UNKNOWN_REGISTRY_TUPLE'
  | 'INVALID_YAML_PAYLOAD';

export type LegacyYamlDbTargetComparisonCode =
  | 'equivalent'
  | 'target-absent'
  | 'parent-blocked'
  | 'conflict';

export type LegacyYamlDbCountMap<Key extends string> = Readonly<Partial<Record<Key, number>>>;

export interface LegacyYamlDbCanonicalTargetRow {
  readonly nodeId: string;
  readonly parentId: string;
  readonly name: string;
  readonly schemaId: string;
  readonly content: string;
}

export interface LegacyYamlDbReadOnlyInventoryOptions {
  readonly indexedDB?: IDBFactory;
  readonly databaseName?: string;
  readonly canonicalTargets?: readonly LegacyYamlDbCanonicalTargetRow[];
}

export type LegacyYamlDbReadOnlyInventoryResult =
  | Readonly<{
      readonly contractVersion: typeof LEGACY_YAMLDB_INVENTORY_CONTRACT_VERSION;
      readonly status: 'accepted';
      readonly nativeVersion: typeof LEGACY_YAMLDB_NATIVE_VERSION;
      readonly rowCount: number;
      readonly validLegacyCount: number;
      readonly invalidCount: number;
      readonly invalidCodeCounts: LegacyYamlDbCountMap<LegacyYamlDbInventoryInvalidCode>;
      readonly targetComparisonCounts?: LegacyYamlDbCountMap<LegacyYamlDbTargetComparisonCode>;
      readonly sourceDigest: string;
    }>
  | Readonly<{
      readonly contractVersion: typeof LEGACY_YAMLDB_INVENTORY_CONTRACT_VERSION;
      readonly status: Extract<LegacyYamlDbInventoryStatus, 'missing' | 'failed'>;
      readonly code: LegacyYamlDbInventoryErrorCode;
    }>;

interface LegacyYamlDbInventoryRow {
  readonly nodeId: string;
  readonly parentId: string;
  readonly name: string;
  readonly schemaId: string;
  readonly content: string;
  readonly subtype: YamlSubtype;
}

interface LegacyYamlDbRawCursorEntry {
  readonly primaryKey: IDBValidKey;
  readonly value: unknown;
}

const registryEntries = Object.values(YAML_SUBTYPE_REGISTRY);

function increment<Key extends string>(counts: Partial<Record<Key, number>>, key: Key): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

function freezeCounts<Key extends string>(
  counts: Partial<Record<Key, number>>
): LegacyYamlDbCountMap<Key> {
  const entries = Object.entries(counts).sort(([left], [right]) => left.localeCompare(right));
  return Object.freeze(Object.fromEntries(entries) as Partial<Record<Key, number>>);
}

function defaultLegacyYamlDatabaseName(): string {
  return getDBName(getBuildDatabasePrefix(), 'yaml');
}

function fail(code: LegacyYamlDbInventoryErrorCode): LegacyYamlDbReadOnlyInventoryResult {
  return Object.freeze({
    contractVersion: LEGACY_YAMLDB_INVENTORY_CONTRACT_VERSION,
    status: code === 'LEGACY_YAMLDB_MISSING' ? 'missing' : 'failed',
    code,
  });
}

function isPlainRecord(value: unknown): value is Record<PropertyKey, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function readOwnDataProperty(
  value: Record<PropertyKey, unknown>,
  key: string
): Readonly<{ kind: 'missing' | 'unsafe' | 'data'; value?: unknown }> {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (descriptor === undefined) return { kind: 'missing' };
  if (!Object.hasOwn(descriptor, 'value')) return { kind: 'unsafe' };
  return { kind: 'data', value: descriptor.value };
}

function hasOnlyHistoricalKeys(value: Record<PropertyKey, unknown>): boolean {
  const allowed = new Set<PropertyKey>(LEGACY_YAMLDB_ROW_KEYS);
  return Reflect.ownKeys(value).every((key) => allowed.has(key));
}

function findRegistrySubtype(name: string, schemaId: string): YamlSubtype | null {
  const matches = registryEntries.filter(
    (entry) => entry.fileName === name && entry.schemaId === schemaId
  );
  if (matches.length !== 1) return null;
  return matches[0]?.subtype ?? null;
}

function validateLegacyRow(
  entry: LegacyYamlDbRawCursorEntry
): Readonly<
  | { ok: true; row: LegacyYamlDbInventoryRow }
  | { ok: false; code: LegacyYamlDbInventoryInvalidCode }
> {
  const { value } = entry;
  if (!isPlainRecord(value)) return { ok: false, code: 'ROW_NOT_PLAIN_OBJECT' };
  if (!hasOnlyHistoricalKeys(value)) return { ok: false, code: 'ROW_UNKNOWN_FIELD' };

  const fields: Partial<Record<(typeof LEGACY_YAMLDB_ROW_KEYS)[number], string>> = {};
  for (const key of LEGACY_YAMLDB_ROW_KEYS) {
    const property = readOwnDataProperty(value, key);
    if (property.kind === 'missing') return { ok: false, code: 'ROW_MISSING_FIELD' };
    if (property.kind === 'unsafe') return { ok: false, code: 'ROW_UNSAFE_PROPERTY' };
    if (typeof property.value !== 'string' || property.value.length === 0) {
      return { ok: false, code: 'ROW_INVALID_FIELD' };
    }
    fields[key] = property.value;
  }

  const { nodeId, parentId, name, schemaId, content } = fields;
  if (
    nodeId === undefined ||
    parentId === undefined ||
    name === undefined ||
    schemaId === undefined ||
    content === undefined
  ) {
    return { ok: false, code: 'ROW_MISSING_FIELD' };
  }

  if (entry.primaryKey !== nodeId) return { ok: false, code: 'PRIMARY_KEY_MISMATCH' };

  const subtype = findRegistrySubtype(name, schemaId);
  if (subtype === null) return { ok: false, code: 'UNKNOWN_REGISTRY_TUPLE' };

  const validation = validateYamlCanonicalPayload(name, {
    subtype,
    schemaId,
    content,
  });
  if (!validation.ok) return { ok: false, code: 'INVALID_YAML_PAYLOAD' };

  return {
    ok: true,
    row: Object.freeze({
      nodeId,
      parentId,
      name,
      schemaId,
      content,
      subtype,
    }),
  };
}

function compareTargets(
  rows: readonly LegacyYamlDbInventoryRow[],
  targets: readonly LegacyYamlDbCanonicalTargetRow[]
): LegacyYamlDbCountMap<LegacyYamlDbTargetComparisonCode> {
  const targetByNodeId = new Map(targets.map((target) => [target.nodeId, target] as const));
  const targetIdentity = new Map(
    targets.map((target) => [`${target.parentId}\u0000${target.name}`, target])
  );
  const counts: Record<LegacyYamlDbTargetComparisonCode, number> = {
    equivalent: 0,
    'target-absent': 0,
    'parent-blocked': 0,
    conflict: 0,
  };

  for (const row of rows) {
    const target = targetByNodeId.get(row.nodeId);
    if (target !== undefined) {
      const equivalent =
        target.parentId === row.parentId &&
        target.name === row.name &&
        target.schemaId === row.schemaId &&
        target.content === row.content;
      increment(counts, equivalent ? 'equivalent' : 'conflict');
      continue;
    }

    const sibling = targetIdentity.get(`${row.parentId}\u0000${row.name}`);
    if (sibling !== undefined && sibling.nodeId !== row.nodeId) {
      increment(counts, 'conflict');
      continue;
    }

    increment(counts, targetByNodeId.has(row.parentId) ? 'target-absent' : 'parent-blocked');
  }

  return freezeCounts(counts);
}

function stableValueForDigest(value: unknown): unknown {
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'undefined') return { type: 'undefined' };
  if (typeof value === 'bigint') return { type: 'bigint', value: value.toString() };
  if (typeof value === 'symbol') return { type: 'symbol' };
  if (typeof value === 'function') return { type: 'function' };
  if (Array.isArray(value)) return value.map(stableValueForDigest);
  if (!isPlainRecord(value)) return { type: typeof value };
  const entries = Reflect.ownKeys(value)
    .map((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      const stableKey = typeof key === 'symbol' ? key.toString() : key;
      if (descriptor === undefined) return [stableKey, { descriptor: 'missing' }] as const;
      if (!Object.hasOwn(descriptor, 'value'))
        return [stableKey, { descriptor: 'accessor' }] as const;
      return [stableKey, stableValueForDigest(descriptor.value)] as const;
    })
    .sort(([left], [right]) => left.localeCompare(right));
  return Object.fromEntries(entries);
}

function appendLengthPrefixedUtf8(chunks: Uint8Array[], text: string): void {
  const bytes = textEncoder.encode(text);
  const length = new Uint8Array(8);
  const view = new DataView(length.buffer);
  view.setBigUint64(0, BigInt(bytes.byteLength), false);
  chunks.push(length, bytes);
}

async function digestSourceEntries(
  entries: readonly LegacyYamlDbRawCursorEntry[],
  classifications: readonly (LegacyYamlDbInventoryInvalidCode | 'valid-legacy')[]
): Promise<string> {
  const chunks: Uint8Array[] = [];
  appendLengthPrefixedUtf8(chunks, 'legacy-yamldb-v1-readonly-inventory');
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const classification = classifications[index] ?? 'ROW_INVALID_FIELD';
    appendLengthPrefixedUtf8(chunks, classification);
    appendLengthPrefixedUtf8(chunks, JSON.stringify(stableValueForDigest(entry)));
  }
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return digestSha256Hex(combined);
}

function openRequestToPromise(
  request: IDBOpenDBRequest,
  context: Readonly<{ unexpectedUpgrade?: () => void; blocked?: () => void }> = {}
): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => context.unexpectedUpgrade?.();
    request.onblocked = () => context.blocked?.();
  });
}

async function openExistingLegacyDatabase(
  factory: IDBFactory,
  databaseName: string
): Promise<
  Readonly<
    { ok: true; database: IDBDatabase } | { ok: false; code: LegacyYamlDbInventoryErrorCode }
  >
> {
  let unexpectedUpgrade = false;
  let blocked = false;
  const request = factory.open(databaseName, LEGACY_YAMLDB_NATIVE_VERSION);
  const databasePromise = openRequestToPromise(request, {
    unexpectedUpgrade: () => {
      unexpectedUpgrade = true;
      request.transaction?.abort();
    },
    blocked: () => {
      blocked = true;
    },
  });
  try {
    return { ok: true, database: await databasePromise };
  } catch {
    if (unexpectedUpgrade) return { ok: false, code: 'LEGACY_YAMLDB_UNEXPECTED_UPGRADE' };
    if (blocked) return { ok: false, code: 'LEGACY_YAMLDB_OPEN_BLOCKED' };
    return { ok: false, code: 'LEGACY_YAMLDB_OPEN_FAILED' };
  }
}

async function readAllLegacyEntries(
  database: IDBDatabase
): Promise<Readonly<{ ok: true; entries: readonly LegacyYamlDbRawCursorEntry[] } | { ok: false }>> {
  if (!database.objectStoreNames.contains(LEGACY_YAMLDB_OBJECT_STORE_NAME)) {
    return { ok: false };
  }
  const transaction = database.transaction(LEGACY_YAMLDB_OBJECT_STORE_NAME, 'readonly');
  const store = transaction.objectStore(LEGACY_YAMLDB_OBJECT_STORE_NAME);
  const entries: LegacyYamlDbRawCursorEntry[] = [];
  return new Promise((resolve) => {
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor === null) return;
      entries.push(Object.freeze({ primaryKey: cursor.primaryKey, value: cursor.value }));
      cursor.continue();
    };
    request.onerror = () => {
      transaction.abort();
      resolve({ ok: false });
    };
    transaction.oncomplete = () => resolve({ ok: true, entries: Object.freeze(entries) });
    transaction.onabort = () => resolve({ ok: false });
    transaction.onerror = () => resolve({ ok: false });
  });
}

async function locateLegacyDatabase(
  factory: IDBFactory,
  databaseName: string
): Promise<Readonly<{ ok: true } | { ok: false; code: LegacyYamlDbInventoryErrorCode }>> {
  let infos: IDBDatabaseInfo[];
  try {
    infos = await factory.databases();
  } catch {
    return { ok: false, code: 'DATABASE_INFO_UNAVAILABLE' };
  }
  const matches = infos.filter((info) => info.name === databaseName);
  if (matches.length === 0) return { ok: false, code: 'LEGACY_YAMLDB_MISSING' };
  if (matches.length > 1) return { ok: false, code: 'LEGACY_YAMLDB_DUPLICATE_INFO' };
  const version = matches[0]?.version;
  if (version !== LEGACY_YAMLDB_NATIVE_VERSION) {
    return { ok: false, code: 'LEGACY_YAMLDB_VERSION_MISMATCH' };
  }
  return { ok: true };
}

export async function getLegacyYamlDbReadOnlyInventory(
  options: LegacyYamlDbReadOnlyInventoryOptions = {}
): Promise<LegacyYamlDbReadOnlyInventoryResult> {
  const factory = options.indexedDB ?? globalThis.indexedDB;
  if (factory === undefined) return fail('DATABASE_INFO_UNAVAILABLE');

  const databaseName = options.databaseName ?? defaultLegacyYamlDatabaseName();
  const located = await locateLegacyDatabase(factory, databaseName);
  if (!located.ok) return fail(located.code);

  const opened = await openExistingLegacyDatabase(factory, databaseName);
  if (!opened.ok) return fail(opened.code);

  try {
    const read = await readAllLegacyEntries(opened.database);
    if (!read.ok) return fail('LEGACY_YAMLDB_TOPOLOGY_MALFORMED');

    const validRows: LegacyYamlDbInventoryRow[] = [];
    const classifications: (LegacyYamlDbInventoryInvalidCode | 'valid-legacy')[] = [];
    const invalidCodeCounts: Partial<Record<LegacyYamlDbInventoryInvalidCode, number>> = {};

    for (const entry of read.entries) {
      const validation = validateLegacyRow(entry);
      if (validation.ok) {
        validRows.push(validation.row);
        classifications.push('valid-legacy');
      } else {
        classifications.push(validation.code);
        increment(invalidCodeCounts, validation.code);
      }
    }

    let sourceDigest: string;
    try {
      sourceDigest = await digestSourceEntries(read.entries, classifications);
    } catch {
      return fail('LEGACY_YAMLDB_DIGEST_FAILED');
    }

    return Object.freeze({
      contractVersion: LEGACY_YAMLDB_INVENTORY_CONTRACT_VERSION,
      status: 'accepted',
      nativeVersion: LEGACY_YAMLDB_NATIVE_VERSION,
      rowCount: read.entries.length,
      validLegacyCount: validRows.length,
      invalidCount: read.entries.length - validRows.length,
      invalidCodeCounts: freezeCounts(invalidCodeCounts),
      ...(options.canonicalTargets === undefined
        ? {}
        : { targetComparisonCounts: compareTargets(validRows, options.canonicalTargets) }),
      sourceDigest,
    });
  } finally {
    opened.database.close();
  }
}
