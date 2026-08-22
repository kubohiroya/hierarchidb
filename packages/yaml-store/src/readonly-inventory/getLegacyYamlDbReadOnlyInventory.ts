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
  | 'LEGACY_YAMLDB_DIGEST_FAILED'
  | 'LEGACY_YAMLDB_CANONICAL_TARGETS_MALFORMED'
  | 'LEGACY_YAMLDB_DISCARD_APPROVAL_MALFORMED';

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

export type LegacyYamlDbAccountingClassification =
  | 'duplicate/no-op'
  | 'recoverable'
  | 'orphan/blocked'
  | 'conflict'
  | 'invalid'
  | 'explicitly-discarded';

export type LegacyYamlDbCountMap<Key extends string> = Readonly<Partial<Record<Key, number>>>;

export interface LegacyYamlDbCanonicalTargetRow {
  readonly nodeId: string;
  readonly nodeType: string;
  readonly parentId: string;
  readonly name: string;
  readonly subtype?: YamlSubtype;
  readonly schemaId: string;
  readonly content: string;
}

export interface LegacyYamlDbExplicitDiscardApproval {
  readonly stableIdentifier: string;
  readonly reason: string;
}

export interface LegacyYamlDbAccountingEvidence {
  readonly stableIdentifier: string;
  readonly classification: LegacyYamlDbAccountingClassification;
}

export interface LegacyYamlDbReadOnlyInventoryOptions {
  readonly indexedDB?: IDBFactory;
  readonly databaseName?: string;
  readonly canonicalTargets?: readonly LegacyYamlDbCanonicalTargetRow[];
  readonly explicitDiscardApprovals?: readonly LegacyYamlDbExplicitDiscardApproval[];
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
      readonly accountingCounts: LegacyYamlDbCountMap<LegacyYamlDbAccountingClassification>;
      readonly accountingEvidence: readonly LegacyYamlDbAccountingEvidence[];
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

type LegacyYamlDbAccountingResult = Readonly<
  | {
      ok: true;
      counts: LegacyYamlDbCountMap<LegacyYamlDbAccountingClassification>;
      validClassifications: readonly LegacyYamlDbAccountingClassification[];
    }
  | { ok: false; code: LegacyYamlDbInventoryErrorCode }
>;

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
  accountingCounts: LegacyYamlDbCountMap<LegacyYamlDbAccountingClassification>
): LegacyYamlDbCountMap<LegacyYamlDbTargetComparisonCode> {
  return freezeCounts({
    equivalent: accountingCounts['duplicate/no-op'] ?? 0,
    'target-absent': accountingCounts.recoverable ?? 0,
    'parent-blocked': accountingCounts['orphan/blocked'] ?? 0,
    conflict: accountingCounts.conflict ?? 0,
  });
}

function createApprovalSet(
  approvals: readonly LegacyYamlDbExplicitDiscardApproval[] | undefined
): Readonly<
  | { ok: true; approvedStableIdentifiers: ReadonlySet<string> }
  | { ok: false; code: LegacyYamlDbInventoryErrorCode }
> {
  if (approvals === undefined) return { ok: true, approvedStableIdentifiers: new Set() };
  const approvedStableIdentifiers = new Set<string>();
  for (const approval of approvals) {
    if (
      isPlainRecord(approval) &&
      typeof approval.stableIdentifier === 'string' &&
      /^[0-9a-f]{64}$/.test(approval.stableIdentifier) &&
      typeof approval.reason === 'string' &&
      approval.reason.length > 0
    ) {
      approvedStableIdentifiers.add(approval.stableIdentifier);
    } else {
      return { ok: false, code: 'LEGACY_YAMLDB_DISCARD_APPROVAL_MALFORMED' };
    }
  }
  return { ok: true, approvedStableIdentifiers };
}

function createTargetIndexes(targets: readonly LegacyYamlDbCanonicalTargetRow[]): Readonly<
  | {
      ok: true;
      targetByNodeId: ReadonlyMap<string, LegacyYamlDbCanonicalTargetRow>;
      targetIdentity: ReadonlyMap<string, LegacyYamlDbCanonicalTargetRow>;
    }
  | { ok: false; code: LegacyYamlDbInventoryErrorCode }
> {
  const targetByNodeId = new Map<string, LegacyYamlDbCanonicalTargetRow>();
  const targetIdentity = new Map<string, LegacyYamlDbCanonicalTargetRow>();
  for (const target of targets) {
    if (
      !isPlainRecord(target) ||
      typeof target.nodeId !== 'string' ||
      target.nodeId.length === 0 ||
      typeof target.nodeType !== 'string' ||
      target.nodeType.length === 0 ||
      typeof target.parentId !== 'string' ||
      target.parentId.length === 0 ||
      typeof target.name !== 'string' ||
      target.name.length === 0 ||
      typeof target.schemaId !== 'string' ||
      typeof target.content !== 'string' ||
      (target.subtype !== undefined && typeof target.subtype !== 'string')
    ) {
      return { ok: false, code: 'LEGACY_YAMLDB_CANONICAL_TARGETS_MALFORMED' };
    }
    const identity = `${target.parentId}\u0000${target.name}`;
    if (targetByNodeId.has(target.nodeId) || targetIdentity.has(identity)) {
      return { ok: false, code: 'LEGACY_YAMLDB_CANONICAL_TARGETS_MALFORMED' };
    }
    targetByNodeId.set(target.nodeId, target);
    targetIdentity.set(identity, target);
  }
  return { ok: true, targetByNodeId, targetIdentity };
}

function computeAccountingCounts(
  rows: readonly LegacyYamlDbInventoryRow[],
  invalidCount: number,
  targets: readonly LegacyYamlDbCanonicalTargetRow[] | undefined,
  explicitDiscardApprovals: readonly LegacyYamlDbExplicitDiscardApproval[] | undefined,
  stableIdentifiers: readonly string[]
): LegacyYamlDbAccountingResult {
  const counts: Record<LegacyYamlDbAccountingClassification, number> = {
    'duplicate/no-op': 0,
    recoverable: 0,
    'orphan/blocked': 0,
    conflict: 0,
    invalid: invalidCount,
    'explicitly-discarded': 0,
  };
  const validClassifications: LegacyYamlDbAccountingClassification[] = [];
  const approvals = createApprovalSet(explicitDiscardApprovals);
  if (approvals.ok === false) return { ok: false, code: approvals.code };
  const { approvedStableIdentifiers } = approvals;
  if (targets === undefined) {
    for (let index = 0; index < rows.length; index += 1) {
      const stableIdentifier = stableIdentifiers[index];
      if (stableIdentifier === undefined) {
        return { ok: false, code: 'LEGACY_YAMLDB_DIGEST_FAILED' };
      }
      const classification = approvedStableIdentifiers.has(stableIdentifier)
        ? 'explicitly-discarded'
        : 'orphan/blocked';
      validClassifications.push(classification);
      increment(counts, classification);
    }
    return Object.freeze({
      ok: true,
      counts: freezeCounts(counts),
      validClassifications: Object.freeze(validClassifications),
    });
  }

  const targetIndexes = createTargetIndexes(targets);
  if (targetIndexes.ok === false) return { ok: false, code: targetIndexes.code };
  const { targetByNodeId, targetIdentity } = targetIndexes;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const stableIdentifier = stableIdentifiers[index];
    if (row === undefined || stableIdentifier === undefined) {
      return { ok: false, code: 'LEGACY_YAMLDB_DIGEST_FAILED' };
    }
    if (approvedStableIdentifiers.has(stableIdentifier)) {
      const classification = 'explicitly-discarded';
      validClassifications.push(classification);
      increment(counts, classification);
      continue;
    }

    const target = targetByNodeId.get(row.nodeId);
    if (target !== undefined) {
      const equivalent =
        target.nodeType === 'yaml-file' &&
        target.parentId === row.parentId &&
        target.name === row.name &&
        target.subtype === row.subtype &&
        target.schemaId === row.schemaId &&
        target.content === row.content;
      const classification = equivalent ? 'duplicate/no-op' : 'conflict';
      validClassifications.push(classification);
      increment(counts, classification);
      continue;
    }

    const sibling = targetIdentity.get(`${row.parentId}\u0000${row.name}`);
    if (sibling !== undefined && sibling.nodeId !== row.nodeId) {
      const classification = 'conflict';
      validClassifications.push(classification);
      increment(counts, classification);
      continue;
    }

    const parent = targetByNodeId.get(row.parentId);
    const classification = parent?.nodeType === 'folder' ? 'recoverable' : 'orphan/blocked';
    validClassifications.push(classification);
    increment(counts, classification);
  }

  return Object.freeze({
    ok: true,
    counts: freezeCounts(counts),
    validClassifications: Object.freeze(validClassifications),
  });
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

async function digestAccountingStableIdentifier(
  entry: LegacyYamlDbRawCursorEntry,
  sourceIndex: number
): Promise<string> {
  const stableInput = JSON.stringify({
    contract: 'legacy-yamldb-v1-accounting-evidence',
    sourceIndex,
    entry: stableValueForDigest(entry),
  });
  return digestSha256Hex(textEncoder.encode(stableInput));
}

async function createAccountingStableIdentifiers(
  entries: readonly LegacyYamlDbRawCursorEntry[]
): Promise<readonly string[]> {
  const stableIdentifiers: string[] = [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (entry === undefined) throw new Error('missing-accounting-entry');
    stableIdentifiers.push(await digestAccountingStableIdentifier(entry, index));
  }
  return Object.freeze(stableIdentifiers);
}

async function createAccountingEvidence(
  stableIdentifiers: readonly string[],
  classifications: readonly LegacyYamlDbAccountingClassification[]
): Promise<readonly LegacyYamlDbAccountingEvidence[]> {
  const evidence: LegacyYamlDbAccountingEvidence[] = [];
  for (let index = 0; index < stableIdentifiers.length; index += 1) {
    const stableIdentifier = stableIdentifiers[index];
    const classification = classifications[index];
    if (stableIdentifier === undefined || classification === undefined) {
      throw new Error('missing-accounting-classification');
    }
    evidence.push(
      Object.freeze({
        stableIdentifier,
        classification,
      })
    );
  }
  return Object.freeze(evidence);
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
  if (located.ok === false) return fail(located.code);

  const opened = await openExistingLegacyDatabase(factory, databaseName);
  if (opened.ok === false) return fail(opened.code);

  try {
    const read = await readAllLegacyEntries(opened.database);
    if (!read.ok) return fail('LEGACY_YAMLDB_TOPOLOGY_MALFORMED');

    const validRows: LegacyYamlDbInventoryRow[] = [];
    const validRowIndexes: number[] = [];
    const classifications: (LegacyYamlDbInventoryInvalidCode | 'valid-legacy')[] = [];
    const accountingClassifications: LegacyYamlDbAccountingClassification[] = [];
    const invalidCodeCounts: Partial<Record<LegacyYamlDbInventoryInvalidCode, number>> = {};

    for (let index = 0; index < read.entries.length; index += 1) {
      const entry = read.entries[index];
      if (entry === undefined) return fail('LEGACY_YAMLDB_READ_FAILED');
      const validation = validateLegacyRow(entry);
      if (validation.ok === true) {
        validRows.push(validation.row);
        validRowIndexes.push(index);
        classifications.push('valid-legacy');
      } else {
        classifications.push(validation.code);
        accountingClassifications[index] = 'invalid';
        increment(invalidCodeCounts, validation.code);
      }
    }

    let sourceDigest: string;
    let stableIdentifiers: readonly string[];
    try {
      sourceDigest = await digestSourceEntries(read.entries, classifications);
      stableIdentifiers = await createAccountingStableIdentifiers(read.entries);
    } catch {
      return fail('LEGACY_YAMLDB_DIGEST_FAILED');
    }
    const validStableIdentifiers: string[] = [];
    for (const sourceIndex of validRowIndexes) {
      const stableIdentifier = stableIdentifiers[sourceIndex];
      if (stableIdentifier === undefined) return fail('LEGACY_YAMLDB_DIGEST_FAILED');
      validStableIdentifiers.push(stableIdentifier);
    }

    const accounting = computeAccountingCounts(
      validRows,
      read.entries.length - validRows.length,
      options.canonicalTargets,
      options.explicitDiscardApprovals,
      validStableIdentifiers
    );
    if (accounting.ok === false) return fail(accounting.code);
    for (let index = 0; index < validRowIndexes.length; index += 1) {
      const sourceIndex = validRowIndexes[index];
      const classification = accounting.validClassifications[index];
      if (sourceIndex === undefined || classification === undefined) {
        return fail('LEGACY_YAMLDB_DIGEST_FAILED');
      }
      accountingClassifications[sourceIndex] = classification;
    }
    let accountingEvidence: readonly LegacyYamlDbAccountingEvidence[];
    try {
      accountingEvidence = await createAccountingEvidence(
        stableIdentifiers,
        accountingClassifications
      );
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
      accountingCounts: accounting.counts,
      accountingEvidence,
      ...(options.canonicalTargets === undefined
        ? {}
        : { targetComparisonCounts: compareTargets(accounting.counts) }),
      sourceDigest,
    });
  } finally {
    opened.database.close();
  }
}
