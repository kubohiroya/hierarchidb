// Keep this application-only read boundary detached from the fixed service-worker graph.
const DATABASE_NAME = 'hierarchidb-origin-coordinator';
const DATABASE_VERSION = 2;
const STATE_STORE_NAME = 'coordinator-state';
const YAML_STATE_KEY = 'yaml-storage';
const PROTOCOL_VERSION = 2;

export type OriginCoordinatorSuccessorStateReadResult = Readonly<
  { readonly ok: true } | { readonly ok: false }
>;

type OwnDataProperty =
  | Readonly<{ readonly found: false }>
  | Readonly<{ readonly found: true; readonly value: unknown }>;

type Participant = Readonly<{
  readonly participantKind: 'tab' | 'worker';
  readonly participantId: string;
}>;

const SUCCESS = Object.freeze({ ok: true as const });
const FAILURE = Object.freeze({ ok: false as const });

function readOwnDataProperty(value: object, key: string): OwnDataProperty {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && 'value' in descriptor
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
    if (!previous || !current || compareParticipants(previous, current) >= 0) return null;
  }
  return Object.freeze(participants);
}

function hasExactReadyEvidence(value: unknown, participants: readonly Participant[]): boolean {
  const items = readExactArray(value);
  if (items === null || items.length !== participants.length) return false;
  const participantById = new Map(
    participants.map((participant) => [participant.participantId, participant] as const)
  );
  const evidence: Participant[] = [];
  const evidenceIds = new Set<string>();
  for (const item of items) {
    if (
      !isPlainObject(item) ||
      !hasExactOwnDataProperties(item, ['participantKind', 'participantId', 'outcome'])
    ) {
      return false;
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
      return false;
    }
    evidenceIds.add(participantId);
    evidence.push(Object.freeze({ participantKind, participantId }));
  }
  for (let index = 1; index < evidence.length; index += 1) {
    const previous = evidence[index - 1];
    const current = evidence[index];
    if (!previous || !current || compareParticipants(previous, current) >= 0) return false;
  }
  return true;
}

function isExactSuccessorState(value: unknown): boolean {
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
    readString(value, 'key') !== YAML_STATE_KEY ||
    !hasOwnDataValue(value, 'protocolVersion', PROTOCOL_VERSION) ||
    readString(value, 'phase') !== 'revoked' ||
    readString(value, 'status') !== 'ready-for-preflight'
  ) {
    return false;
  }
  const activationId = readString(value, 'activationId');
  const quiescenceRequestId = readString(value, 'quiescenceRequestId');
  const participantsProperty = readOwnDataProperty(value, 'participants');
  const evidenceProperty = readOwnDataProperty(value, 'evidence');
  const participants = participantsProperty.found
    ? parseParticipants(participantsProperty.value)
    : null;
  return (
    activationId !== null &&
    activationId.length > 0 &&
    quiescenceRequestId !== null &&
    quiescenceRequestId.length > 0 &&
    participants !== null &&
    evidenceProperty.found &&
    hasExactReadyEvidence(evidenceProperty.value, participants)
  );
}

function hasExactStoreTopology(database: IDBDatabase): boolean {
  return (
    database.objectStoreNames.length === 1 && database.objectStoreNames.contains(STATE_STORE_NAME)
  );
}

function hasExactStoreSchema(store: IDBObjectStore): boolean {
  return store.keyPath === 'key' && !store.autoIncrement && store.indexNames.length === 0;
}

async function databaseVersionExists(factory: IDBFactory): Promise<boolean> {
  if (typeof factory.databases !== 'function') return false;
  const databases = await factory.databases();
  const matches = databases.filter((entry) => entry.name === DATABASE_NAME);
  return matches.length === 1 && matches[0]?.version === DATABASE_VERSION;
}

async function openExistingDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  if (!(await databaseVersionExists(factory))) {
    throw new Error('origin-coordinator-database-missing-or-version-mismatch');
  }
  return await new Promise((resolve, reject) => {
    let unexpectedUpgrade = false;
    let settled = false;
    const request = factory.open(DATABASE_NAME, DATABASE_VERSION);
    const fail = (error: Error): void => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    request.onupgradeneeded = () => {
      unexpectedUpgrade = true;
      request.transaction?.abort();
    };
    request.onerror = () => {
      fail(
        new Error(
          unexpectedUpgrade
            ? 'origin-coordinator-unexpected-upgrade'
            : 'origin-coordinator-database-open-failed'
        )
      );
    };
    request.onblocked = () => fail(new Error('origin-coordinator-database-open-blocked'));
    request.onsuccess = () => {
      if (settled) {
        request.result.close();
        return;
      }
      settled = true;
      resolve(request.result);
    };
  });
}

async function readOnlyState(database: IDBDatabase): Promise<unknown> {
  if (!hasExactStoreTopology(database)) return null;
  const transaction = database.transaction(STATE_STORE_NAME, 'readonly');
  const store = transaction.objectStore(STATE_STORE_NAME);
  if (!hasExactStoreSchema(store)) return null;
  return await new Promise((resolve, reject) => {
    const request = store.getAll();
    let state: unknown = null;
    request.onerror = () => {
      reject(request.error ?? new Error('origin-coordinator-state-read-failed'));
    };
    request.onsuccess = () => {
      state = request.result.length === 1 ? request.result[0] : null;
    };
    transaction.onabort = () => {
      reject(transaction.error ?? new Error('origin-coordinator-state-read-aborted'));
    };
    transaction.oncomplete = () => resolve(state);
  });
}

export async function readOriginCoordinatorSuccessorState(
  factory: IDBFactory
): Promise<OriginCoordinatorSuccessorStateReadResult> {
  let database: IDBDatabase | null = null;
  try {
    database = await openExistingDatabase(factory);
    return isExactSuccessorState(await readOnlyState(database)) ? SUCCESS : FAILURE;
  } catch {
    return FAILURE;
  } finally {
    database?.close();
  }
}
