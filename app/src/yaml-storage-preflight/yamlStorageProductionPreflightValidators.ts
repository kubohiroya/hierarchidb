import {
  CORE_DB_CANONICAL_LOGICAL_VERSION,
  CORE_DB_CANONICAL_NATIVE_VERSION,
  CORE_DB_LEGACY_LOGICAL_VERSION,
  CORE_DB_LEGACY_NATIVE_VERSION,
} from '@hierarchidb/runtime-worker/yaml-storage-production';

interface IndexSpec {
  readonly name: string;
  readonly keyPath: string | readonly string[];
  readonly unique: boolean;
  readonly multiEntry: boolean;
}

interface StoreSpec {
  readonly name: string;
  readonly keyPath: string | readonly string[];
  readonly indexes: readonly IndexSpec[];
}

type OwnDataProperty =
  | Readonly<{ readonly found: false }>
  | Readonly<{ readonly found: true; readonly value: unknown }>;

interface Participant {
  readonly participantKind: 'tab' | 'worker';
  readonly participantId: string;
}

interface ParticipantEvidence extends Participant {
  readonly outcome: 'acknowledged' | 'discarded';
}

export interface CoordinatorReadyStateEvidence {
  readonly activationId: string;
  readonly quiescenceRequestId: string;
  readonly participants: readonly Participant[];
  readonly evidence: readonly ParticipantEvidence[];
}

export type CoordinatorStateSummary =
  | Readonly<{
      readonly phase: 'allowed';
      readonly participantCount: 0;
      readonly evidenceCount: 0;
    }>
  | Readonly<{
      readonly phase: 'revoked';
      readonly stateStatus: 'ready-for-preflight';
      readonly participantCount: number;
      readonly evidenceCount: number;
    }>;

const CORE_DB_V1_STORE_SPECS: readonly StoreSpec[] = Object.freeze([
  Object.freeze({
    name: 'trees',
    keyPath: 'id',
    indexes: Object.freeze([
      Object.freeze({ name: 'rootId', keyPath: 'rootId', unique: false, multiEntry: false }),
      Object.freeze({
        name: 'archiveRootId',
        keyPath: 'archiveRootId',
        unique: false,
        multiEntry: false,
      }),
      Object.freeze({
        name: 'superRootId',
        keyPath: 'superRootId',
        unique: false,
        multiEntry: false,
      }),
    ]),
  }),
  Object.freeze({
    name: 'nodes',
    keyPath: 'id',
    indexes: Object.freeze([
      Object.freeze({ name: 'parentId', keyPath: 'parentId', unique: false, multiEntry: false }),
      Object.freeze({
        name: '[parentId+metadata.name]',
        keyPath: Object.freeze(['parentId', 'metadata.name']),
        unique: true,
        multiEntry: false,
      }),
      Object.freeze({
        name: '[parentId+updatedAt]',
        keyPath: Object.freeze(['parentId', 'updatedAt']),
        unique: false,
        multiEntry: false,
      }),
      Object.freeze({ name: 'depth', keyPath: 'depth', unique: false, multiEntry: false }),
      Object.freeze({
        name: 'references',
        keyPath: 'references',
        unique: false,
        multiEntry: true,
      }),
    ]),
  }),
  Object.freeze({ name: 'rootStates', keyPath: 'rootNodeId', indexes: Object.freeze([]) }),
  Object.freeze({
    name: 'tags',
    keyPath: 'id',
    indexes: Object.freeze([
      Object.freeze({ name: 'name', keyPath: 'name', unique: false, multiEntry: false }),
      Object.freeze({
        name: 'createdAt',
        keyPath: 'createdAt',
        unique: false,
        multiEntry: false,
      }),
    ]),
  }),
  Object.freeze({
    name: 'tagAssociations',
    keyPath: 'id',
    indexes: Object.freeze([
      Object.freeze({ name: 'nodeId', keyPath: 'nodeId', unique: false, multiEntry: false }),
      Object.freeze({ name: 'tagId', keyPath: 'tagId', unique: false, multiEntry: false }),
      Object.freeze({ name: 'scope', keyPath: 'scope', unique: false, multiEntry: false }),
      Object.freeze({
        name: 'createdAt',
        keyPath: 'createdAt',
        unique: false,
        multiEntry: false,
      }),
      Object.freeze({
        name: '[nodeId+tagId+scope]',
        keyPath: Object.freeze(['nodeId', 'tagId', 'scope']),
        unique: true,
        multiEntry: false,
      }),
    ]),
  }),
]);

const YAML_MIGRATION_JOURNAL_STORE_SPEC: StoreSpec = Object.freeze({
  name: 'yamlMigrationJournal',
  keyPath: Object.freeze(['migrationId', 'nodeId', 'slot']),
  indexes: Object.freeze([
    Object.freeze({
      name: '[migrationId+fromCoreDbVersion+toCoreDbVersion]',
      keyPath: Object.freeze(['migrationId', 'fromCoreDbVersion', 'toCoreDbVersion']),
      unique: false,
      multiEntry: false,
    }),
  ]),
});

const COORDINATOR_STORE_SPEC: StoreSpec = Object.freeze({
  name: 'coordinator-state',
  keyPath: 'key',
  indexes: Object.freeze([]),
});

const YAML_DB_STORE_SPEC: StoreSpec = Object.freeze({
  name: 'nodes',
  keyPath: 'nodeId',
  indexes: Object.freeze([
    Object.freeze({ name: 'parentId', keyPath: 'parentId', unique: false, multiEntry: false }),
  ]),
});

function readOwnDataProperty(value: object, key: string): OwnDataProperty {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor !== undefined && 'value' in descriptor
    ? { found: true, value: descriptor.value }
    : { found: false };
}

function isPlainObject(value: unknown): value is object {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactOwnDataProperties(value: object, expectedKeys: readonly string[]): boolean {
  const keys = Reflect.ownKeys(value);
  return (
    keys.length === expectedKeys.length &&
    keys.every((key) => typeof key === 'string' && expectedKeys.includes(key)) &&
    expectedKeys.every((key) => readOwnDataProperty(value, key).found)
  );
}

function readExactArray(value: unknown): readonly unknown[] | null {
  if (!Array.isArray(value) || Object.getOwnPropertySymbols(value).length !== 0) return null;
  const names = Object.getOwnPropertyNames(value);
  if (names.length !== value.length + 1 || !names.includes('length')) return null;
  for (let index = 0; index < value.length; index += 1) {
    if (!names.includes(String(index)) || !readOwnDataProperty(value, String(index)).found) {
      return null;
    }
  }
  return value;
}

function readString(value: object, key: string): string | null {
  const property = readOwnDataProperty(value, key);
  return property.found && typeof property.value === 'string' ? property.value : null;
}

function hasOwnDataValue(value: object, key: string, expected: unknown): boolean {
  const property = readOwnDataProperty(value, key);
  return property.found && property.value === expected;
}

function compareParticipants(left: Participant, right: Participant): number {
  if (left.participantKind !== right.participantKind) {
    return left.participantKind === 'tab' ? -1 : 1;
  }
  return left.participantId < right.participantId
    ? -1
    : left.participantId > right.participantId
      ? 1
      : 0;
}

function parseParticipant(value: unknown): Participant | null {
  if (
    !isPlainObject(value) ||
    !hasExactOwnDataProperties(value, ['participantKind', 'participantId'])
  ) {
    return null;
  }
  const participantKind = readString(value, 'participantKind');
  const participantId = readString(value, 'participantId');
  if (
    (participantKind !== 'tab' && participantKind !== 'worker') ||
    participantId === null ||
    participantId.length === 0
  ) {
    return null;
  }
  return Object.freeze({ participantKind, participantId });
}

function parseParticipants(value: unknown): readonly Participant[] | null {
  const items = readExactArray(value);
  if (items === null || items.length === 0) return null;
  const participants: Participant[] = [];
  const participantIds = new Set<string>();
  for (const item of items) {
    const participant = parseParticipant(item);
    if (participant === null || participantIds.has(participant.participantId)) return null;
    participantIds.add(participant.participantId);
    participants.push(participant);
  }
  for (let index = 1; index < participants.length; index += 1) {
    const previous = participants[index - 1];
    const current = participants[index];
    if (
      previous === undefined ||
      current === undefined ||
      compareParticipants(previous, current) >= 0
    ) {
      return null;
    }
  }
  return Object.freeze(participants);
}

function hasExactReadyEvidence(value: unknown, participants: readonly Participant[]): boolean {
  return parseReadyEvidence(value, participants) !== null;
}

function parseReadyEvidence(
  value: unknown,
  participants: readonly Participant[]
): readonly ParticipantEvidence[] | null {
  const items = readExactArray(value);
  if (items === null || items.length !== participants.length) return null;
  const participantById = new Map(
    participants.map((participant) => [participant.participantId, participant] as const)
  );
  const evidence: ParticipantEvidence[] = [];
  const evidenceIds = new Set<string>();
  for (const item of items) {
    if (
      !isPlainObject(item) ||
      !hasExactOwnDataProperties(item, ['participantKind', 'participantId', 'outcome'])
    ) {
      return null;
    }
    const participantKind = readString(item, 'participantKind');
    const participantId = readString(item, 'participantId');
    const outcome = readString(item, 'outcome');
    const expected = participantId === null ? undefined : participantById.get(participantId);
    if (
      (participantKind !== 'tab' && participantKind !== 'worker') ||
      participantId === null ||
      participantId.length === 0 ||
      (outcome !== 'acknowledged' && outcome !== 'discarded') ||
      expected === undefined ||
      expected.participantKind !== participantKind ||
      evidenceIds.has(participantId)
    ) {
      return null;
    }
    evidenceIds.add(participantId);
    evidence.push(Object.freeze({ participantKind, participantId, outcome }));
  }
  for (let index = 1; index < evidence.length; index += 1) {
    const previous = evidence[index - 1];
    const current = evidence[index];
    if (
      previous === undefined ||
      current === undefined ||
      compareParticipants(previous, current) >= 0
    ) {
      return null;
    }
  }
  return Object.freeze(evidence);
}

function keyPathMatches(
  actual: string | string[] | null,
  expected: string | readonly string[]
): boolean {
  if (typeof expected === 'string') return actual === expected;
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    actual.every((entry, index) => entry === expected[index])
  );
}

function stringListsMatch(actual: DOMStringList, expected: readonly string[]): boolean {
  const actualValues = Array.from(actual).sort();
  const expectedValues = [...expected].sort();
  return (
    actualValues.length === expectedValues.length &&
    actualValues.every((value, index) => value === expectedValues[index])
  );
}

function storeMatches(store: IDBObjectStore, spec: StoreSpec): boolean {
  if (store.autoIncrement || !keyPathMatches(store.keyPath, spec.keyPath)) return false;
  if (
    !stringListsMatch(
      store.indexNames,
      spec.indexes.map((index) => index.name)
    )
  ) {
    return false;
  }
  return spec.indexes.every((indexSpec) => {
    const index = store.index(indexSpec.name);
    return (
      keyPathMatches(index.keyPath, indexSpec.keyPath) &&
      index.unique === indexSpec.unique &&
      index.multiEntry === indexSpec.multiEntry
    );
  });
}

function validateStoreSpecs(database: IDBDatabase, specs: readonly StoreSpec[]): boolean {
  try {
    if (
      !stringListsMatch(
        database.objectStoreNames,
        specs.map((spec) => spec.name)
      )
    ) {
      return false;
    }
    const transaction = database.transaction(
      specs.map((spec) => spec.name),
      'readonly'
    );
    return specs.every((spec) => storeMatches(transaction.objectStore(spec.name), spec));
  } catch {
    return false;
  }
}

export function validateCoordinatorDatabaseSchema(database: IDBDatabase): boolean {
  return database.version === 2 && validateStoreSpecs(database, [COORDINATOR_STORE_SPEC]);
}

export function validateCoreDatabaseSchema(database: IDBDatabase, logicalVersion: number): boolean {
  if (
    logicalVersion !== CORE_DB_LEGACY_LOGICAL_VERSION &&
    logicalVersion !== CORE_DB_CANONICAL_LOGICAL_VERSION
  ) {
    return false;
  }
  const specs =
    logicalVersion === CORE_DB_LEGACY_LOGICAL_VERSION
      ? CORE_DB_V1_STORE_SPECS
      : [...CORE_DB_V1_STORE_SPECS, YAML_MIGRATION_JOURNAL_STORE_SPEC];
  const nativeVersion =
    logicalVersion === CORE_DB_LEGACY_LOGICAL_VERSION
      ? CORE_DB_LEGACY_NATIVE_VERSION
      : CORE_DB_CANONICAL_NATIVE_VERSION;
  return database.version === nativeVersion && validateStoreSpecs(database, specs);
}

export function validateYamlDatabaseSchema(database: IDBDatabase): boolean {
  return database.version === 1 && validateStoreSpecs(database, [YAML_DB_STORE_SPEC]);
}

export function parseCoordinatorState(
  value: unknown,
  expectedPhase: 'allowed' | 'revoked'
): CoordinatorStateSummary | null {
  try {
    if (!isPlainObject(value)) return null;
    if (expectedPhase === 'allowed') {
      if (
        !hasExactOwnDataProperties(value, ['key', 'protocolVersion', 'phase']) ||
        readString(value, 'key') !== 'yaml-storage' ||
        !hasOwnDataValue(value, 'protocolVersion', 2) ||
        readString(value, 'phase') !== 'allowed'
      ) {
        return null;
      }
      return Object.freeze({ phase: 'allowed', participantCount: 0, evidenceCount: 0 });
    }
    if (
      !hasExactOwnDataProperties(value, [
        'key',
        'protocolVersion',
        'phase',
        'status',
        'activationId',
        'quiescenceRequestId',
        'participants',
        'evidence',
      ]) ||
      readString(value, 'key') !== 'yaml-storage' ||
      !hasOwnDataValue(value, 'protocolVersion', 2) ||
      readString(value, 'phase') !== 'revoked' ||
      readString(value, 'status') !== 'ready-for-preflight'
    ) {
      return null;
    }
    const activationId = readString(value, 'activationId');
    const quiescenceRequestId = readString(value, 'quiescenceRequestId');
    const participantsProperty = readOwnDataProperty(value, 'participants');
    const evidenceProperty = readOwnDataProperty(value, 'evidence');
    const participants = participantsProperty.found
      ? parseParticipants(participantsProperty.value)
      : null;
    if (
      activationId === null ||
      activationId.length === 0 ||
      quiescenceRequestId === null ||
      quiescenceRequestId.length === 0 ||
      participants === null ||
      !evidenceProperty.found ||
      !hasExactReadyEvidence(evidenceProperty.value, participants)
    ) {
      return null;
    }
    return Object.freeze({
      phase: 'revoked',
      stateStatus: 'ready-for-preflight',
      participantCount: participants.length,
      evidenceCount: participants.length,
    });
  } catch {
    return null;
  }
}

export function parseCoordinatorReadyStateEvidence(
  value: unknown
): CoordinatorReadyStateEvidence | null {
  try {
    if (
      !isPlainObject(value) ||
      !hasExactOwnDataProperties(value, [
        'key',
        'protocolVersion',
        'phase',
        'status',
        'activationId',
        'quiescenceRequestId',
        'participants',
        'evidence',
      ]) ||
      readString(value, 'key') !== 'yaml-storage' ||
      !hasOwnDataValue(value, 'protocolVersion', 2) ||
      readString(value, 'phase') !== 'revoked' ||
      readString(value, 'status') !== 'ready-for-preflight'
    ) {
      return null;
    }
    const activationId = readString(value, 'activationId');
    const quiescenceRequestId = readString(value, 'quiescenceRequestId');
    const participantsProperty = readOwnDataProperty(value, 'participants');
    const evidenceProperty = readOwnDataProperty(value, 'evidence');
    const participants = participantsProperty.found
      ? parseParticipants(participantsProperty.value)
      : null;
    const evidence =
      participants !== null && evidenceProperty.found
        ? parseReadyEvidence(evidenceProperty.value, participants)
        : null;
    if (
      activationId === null ||
      activationId.length === 0 ||
      quiescenceRequestId === null ||
      quiescenceRequestId.length === 0 ||
      participants === null ||
      evidence === null
    ) {
      return null;
    }
    return Object.freeze({ activationId, quiescenceRequestId, participants, evidence });
  } catch {
    return null;
  }
}

function appendLengthPrefixedString(chunks: number[], value: string): void {
  const bytes = new TextEncoder().encode(value);
  const length = bytes.length;
  chunks.push(
    (length >>> 24) & 0xff,
    (length >>> 16) & 0xff,
    (length >>> 8) & 0xff,
    length & 0xff,
    ...bytes
  );
}

export function encodeCoordinatorReadyStateFingerprint(
  evidence: CoordinatorReadyStateEvidence
): Uint8Array {
  const chunks: number[] = [];
  appendLengthPrefixedString(chunks, 'hierarchidb-yaml-storage-corrective-recovery-coordinator-v1');
  appendLengthPrefixedString(chunks, evidence.activationId);
  appendLengthPrefixedString(chunks, evidence.quiescenceRequestId);
  appendLengthPrefixedString(chunks, String(evidence.participants.length));
  for (const participant of evidence.participants) {
    appendLengthPrefixedString(chunks, participant.participantKind);
    appendLengthPrefixedString(chunks, participant.participantId);
  }
  appendLengthPrefixedString(chunks, String(evidence.evidence.length));
  for (const item of evidence.evidence) {
    appendLengthPrefixedString(chunks, item.participantKind);
    appendLengthPrefixedString(chunks, item.participantId);
    appendLengthPrefixedString(chunks, item.outcome);
  }
  return new Uint8Array(chunks);
}

function encodeByteSequence(bytes: Uint8Array): string {
  let output = '';
  for (const byte of bytes) output += byte.toString(16).padStart(2, '0');
  return output;
}

function encodeNumber(value: number): string {
  if (Number.isNaN(value)) return 'number:NaN;';
  if (value === Number.POSITIVE_INFINITY) return 'number:+Infinity;';
  if (value === Number.NEGATIVE_INFINITY) return 'number:-Infinity;';
  if (Object.is(value, -0)) return 'number:-0;';
  return `number:${String(value)};`;
}

function encodeCanonicalValue(
  value: unknown,
  seen: Map<object, number>,
  nextReference: { value: number }
): string {
  if (value === null) return 'null;';
  if (value === undefined) return 'undefined;';
  if (typeof value === 'boolean') return value ? 'boolean:1;' : 'boolean:0;';
  if (typeof value === 'number') return encodeNumber(value);
  if (typeof value === 'bigint') return `bigint:${String(value)};`;
  if (typeof value === 'string') return `string:${value.length}:${value};`;
  if (typeof value !== 'object') throw new Error('unsupported-snapshot-value');

  const existingReference = seen.get(value);
  if (existingReference !== undefined) return `reference:${existingReference};`;
  const reference = nextReference.value;
  nextReference.value += 1;
  seen.set(value, reference);

  if (value instanceof Date) {
    const timestamp = value.getTime();
    if (!Number.isFinite(timestamp)) throw new Error('invalid-snapshot-date');
    return `date#${reference}:${timestamp};`;
  }
  if (value instanceof ArrayBuffer) {
    return `array-buffer#${reference}:${encodeByteSequence(new Uint8Array(value))};`;
  }
  if (ArrayBuffer.isView(value)) {
    const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    return `array-buffer-view#${reference}:${value.constructor.name}:${encodeByteSequence(bytes)};`;
  }
  if (value instanceof Map) {
    let output = `map#${reference}:${value.size}{`;
    for (const [key, entry] of value.entries()) {
      output += encodeCanonicalValue(key, seen, nextReference);
      output += encodeCanonicalValue(entry, seen, nextReference);
    }
    return `${output}}`;
  }
  if (value instanceof Set) {
    let output = `set#${reference}:${value.size}{`;
    for (const entry of value.values()) {
      output += encodeCanonicalValue(entry, seen, nextReference);
    }
    return `${output}}`;
  }
  if (Array.isArray(value)) {
    const names = Object.getOwnPropertyNames(value);
    const permittedNames = new Set(['length']);
    for (let index = 0; index < value.length; index += 1) permittedNames.add(String(index));
    if (
      Object.getOwnPropertySymbols(value).length !== 0 ||
      names.some((name) => !permittedNames.has(name))
    ) {
      throw new Error('unsupported-snapshot-array-shape');
    }
    let output = `array#${reference}:${value.length}[`;
    for (let index = 0; index < value.length; index += 1) {
      const property = readOwnDataProperty(value, String(index));
      output += property.found
        ? encodeCanonicalValue(property.value, seen, nextReference)
        : 'hole;';
    }
    return `${output}]`;
  }
  if (!isPlainObject(value)) throw new Error('unsupported-snapshot-object');
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== 'string')) {
    throw new Error('unsupported-snapshot-symbol');
  }
  const stringKeys = keys.filter((key): key is string => typeof key === 'string').sort();
  let output = `object#${reference}:${stringKeys.length}{`;
  for (const key of stringKeys) {
    const property = readOwnDataProperty(value, key);
    if (!property.found) throw new Error('unsupported-snapshot-accessor');
    output += `key:${key.length}:${key};`;
    output += encodeCanonicalValue(property.value, seen, nextReference);
  }
  return `${output}}`;
}

export function encodeYamlDatabaseSnapshot(
  keys: readonly IDBValidKey[],
  rows: readonly unknown[]
): Uint8Array {
  if (keys.length !== rows.length) throw new Error('yaml-snapshot-length-mismatch');
  const seen = new Map<object, number>();
  const nextReference = { value: 0 };
  const encoded = encodeCanonicalValue(
    Object.freeze({ keys: Object.freeze([...keys]), rows: Object.freeze([...rows]) }),
    seen,
    nextReference
  );
  return new TextEncoder().encode(encoded);
}
