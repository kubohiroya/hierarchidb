import { planYamlCoreDbMigration } from '@hierarchidb/yaml-api/migration';
import {
  CORE_DB_CANONICAL_LOGICAL_VERSION,
  CORE_DB_LEGACY_LOGICAL_VERSION,
} from './yamlStorageCoreDbVersionConstants.js';

type PlainRecord = Record<PropertyKey, unknown>;
type StoreName = keyof InterruptedCoreV1Snapshot;
type RecordClassification =
  | 'exact-default'
  | 'modified-default-identity'
  | 'additional'
  | 'invalid';
export type InterruptedCoreV1InvalidReasonCode =
  | 'record-shape'
  | 'required-identity'
  | 'required-field-contract'
  | 'metadata-contract'
  | 'relationship-contract'
  | 'duplicate-identity'
  | 'yaml-contract';

interface RecordState {
  readonly store: StoreName;
  readonly index: number;
  readonly value: unknown;
  identity: string | null;
  classification: RecordClassification;
  invalidReason: InterruptedCoreV1InvalidReasonCode | null;
}

interface ParsedTree {
  readonly state: RecordState;
  readonly id: string;
  readonly rootId: string;
  readonly archiveRootId: string;
  readonly superRootId: string;
}

interface ParsedNode {
  readonly state: RecordState;
  readonly id: string;
  readonly parentId: string;
  readonly nodeType: string;
  readonly references: readonly string[];
}

interface ParsedRootState {
  readonly state: RecordState;
  readonly rootNodeId: string;
  readonly treeId: string;
  readonly expandedNodeIds: readonly string[];
}

interface ParsedTag {
  readonly state: RecordState;
  readonly id: string;
}

interface ParsedTagAssociation {
  readonly state: RecordState;
  readonly id: string;
  readonly nodeId: string;
  readonly tagId: string;
}

export interface InterruptedCoreV1Snapshot {
  readonly trees: readonly unknown[];
  readonly nodes: readonly unknown[];
  readonly rootStates: readonly unknown[];
  readonly tags: readonly unknown[];
  readonly tagAssociations: readonly unknown[];
}

export interface ClassifyInterruptedCoreV1SnapshotInput {
  readonly snapshot: InterruptedCoreV1Snapshot;
  readonly digestSha256Hex: (bytes: Uint8Array) => Promise<string>;
}

export interface InterruptedCoreV1PreservationSummary {
  readonly storeCounts: Readonly<{
    readonly trees: number;
    readonly nodes: number;
    readonly rootStates: number;
    readonly tags: number;
    readonly tagAssociations: number;
    readonly total: number;
  }>;
  readonly recordClassification: Readonly<{
    readonly exactDefault: number;
    readonly modifiedDefaultIdentity: number;
    readonly additional: number;
    readonly invalid: number;
  }>;
  readonly invalidDiagnostics: Readonly<{
    readonly byStore: Readonly<{
      readonly trees: number;
      readonly nodes: number;
      readonly rootStates: number;
      readonly tags: number;
      readonly tagAssociations: number;
      readonly total: number;
    }>;
    readonly byReason: Readonly<Record<InterruptedCoreV1InvalidReasonCode, number>>;
    readonly byIdentityClass: Readonly<{
      readonly defaultIdentity: number;
      readonly additionalIdentity: number;
      readonly unavailableIdentity: number;
    }>;
  }>;
  readonly additionalNodeCounts: Readonly<{
    readonly yaml: number;
    readonly nonYaml: number;
  }>;
  readonly graphStatus: 'not-evaluated' | 'exact' | 'invalid';
  readonly yamlPlanningStatus: 'not-run' | 'valid' | 'invalid';
  readonly yamlSlotCounts: Readonly<{
    readonly canonical: number;
    readonly legacyWithName: number;
    readonly hostSplitLegacy: number;
    readonly temporaryPlaceholder: number;
    readonly metadataOnlyDraft: number;
  }> | null;
}

export type InterruptedCoreV1PreservationClassificationCode =
  | 'INTERRUPTED_CORE_V1_PRESERVATION_ACCEPTED'
  | 'INTERRUPTED_CORE_V1_PRESERVATION_SNAPSHOT_INVALID'
  | 'INTERRUPTED_CORE_V1_PRESERVATION_GRAPH_INVALID'
  | 'INTERRUPTED_CORE_V1_PRESERVATION_YAML_INVALID'
  | 'INTERRUPTED_CORE_V1_PRESERVATION_INTERNAL_FAILED';

export type InterruptedCoreV1PreservationClassificationResult =
  | Readonly<{
      readonly ok: true;
      readonly code: 'INTERRUPTED_CORE_V1_PRESERVATION_ACCEPTED';
      readonly summary: InterruptedCoreV1PreservationSummary;
    }>
  | Readonly<{
      readonly ok: false;
      readonly code: Exclude<
        InterruptedCoreV1PreservationClassificationCode,
        'INTERRUPTED_CORE_V1_PRESERVATION_ACCEPTED'
      >;
      readonly summary?: InterruptedCoreV1PreservationSummary;
    }>;

const STORE_NAMES = Object.freeze([
  'trees',
  'nodes',
  'rootStates',
  'tags',
  'tagAssociations',
] as const satisfies readonly StoreName[]);
const STORE_COUNT_NAMES = Object.freeze([...STORE_NAMES, 'total'] as const);
const RECORD_CLASSIFICATION_NAMES = Object.freeze([
  'exactDefault',
  'modifiedDefaultIdentity',
  'additional',
  'invalid',
] as const);
const INVALID_REASON_CODES = Object.freeze([
  'record-shape',
  'required-identity',
  'required-field-contract',
  'metadata-contract',
  'relationship-contract',
  'duplicate-identity',
  'yaml-contract',
] as const satisfies readonly InterruptedCoreV1InvalidReasonCode[]);
const INVALID_IDENTITY_CLASS_NAMES = Object.freeze([
  'defaultIdentity',
  'additionalIdentity',
  'unavailableIdentity',
] as const);
const ADDITIONAL_NODE_COUNT_NAMES = Object.freeze(['yaml', 'nonYaml'] as const);
const YAML_SLOT_COUNT_NAMES = Object.freeze([
  'canonical',
  'legacyWithName',
  'hostSplitLegacy',
  'temporaryPlaceholder',
  'metadataOnlyDraft',
] as const);
const SUMMARY_PROPERTY_NAMES = Object.freeze([
  'storeCounts',
  'recordClassification',
  'invalidDiagnostics',
  'additionalNodeCounts',
  'graphStatus',
  'yamlPlanningStatus',
  'yamlSlotCounts',
] as const);

const DEFAULT_TREE_IDENTITIES = Object.freeze(['r', 'p'] as const);
const DEFAULT_NODE_IDENTITIES = Object.freeze(
  DEFAULT_TREE_IDENTITIES.flatMap((treeId) => [`${treeId}:root`, `${treeId}:archive`])
);
const DEFAULT_ROOT_STATE_IDENTITIES = Object.freeze(
  DEFAULT_TREE_IDENTITIES.flatMap((treeId) => [
    `${treeId}:root`,
    `${treeId}:archive`,
    `${treeId}:draft`,
  ])
);
const DEFAULT_TREE_IDENTITY_SET = new Set<string>(DEFAULT_TREE_IDENTITIES);
const DEFAULT_NODE_IDENTITY_SET = new Set<string>(DEFAULT_NODE_IDENTITIES);
const DEFAULT_ROOT_STATE_IDENTITY_SET = new Set<string>(DEFAULT_ROOT_STATE_IDENTITIES);
const EXPECTED_DEFAULT_IDENTITY_COUNT =
  DEFAULT_TREE_IDENTITIES.length +
  DEFAULT_NODE_IDENTITIES.length +
  DEFAULT_ROOT_STATE_IDENTITIES.length;

type OwnDataProperty =
  | Readonly<{ readonly found: false }>
  | Readonly<{ readonly found: true; readonly value: unknown }>;

function readOwnDataProperty(value: object, key: PropertyKey): OwnDataProperty {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && Object.hasOwn(descriptor, 'value')
      ? Object.freeze({ found: true, value: descriptor.value })
      : Object.freeze({ found: false });
  } catch {
    return Object.freeze({ found: false });
  }
}

function isPlainRecord(value: unknown): value is PlainRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function hasOnlyOwnDataProperties(value: PlainRecord): boolean {
  try {
    return Reflect.ownKeys(value).every(
      (key) => typeof key === 'string' && readOwnDataProperty(value, key).found
    );
  } catch {
    return false;
  }
}

function hasExactOwnDataProperties(value: PlainRecord, expected: readonly string[]): boolean {
  if (!hasOnlyOwnDataProperties(value)) return false;
  try {
    const keys = Reflect.ownKeys(value);
    return (
      keys.length === expected.length &&
      keys.every((key) => typeof key === 'string' && expected.includes(key))
    );
  } catch {
    return false;
  }
}

function readNonEmptyString(value: PlainRecord, key: string): string | null {
  const property = readOwnDataProperty(value, key);
  return property.found && typeof property.value === 'string' && property.value.length > 0
    ? property.value
    : null;
}

function readSafeTimestamp(value: PlainRecord, key: string): number | null {
  const property = readOwnDataProperty(value, key);
  return property.found &&
    typeof property.value === 'number' &&
    Number.isSafeInteger(property.value) &&
    property.value >= 0
    ? property.value
    : null;
}

function readNonNegativeInteger(value: PlainRecord, key: string): number | null {
  return readSafeTimestamp(value, key);
}

function readExactStringArray(value: unknown): readonly string[] | null {
  if (!Array.isArray(value)) return null;
  try {
    if (Object.getOwnPropertySymbols(value).length !== 0) return null;
    const names = Object.getOwnPropertyNames(value);
    if (names.length !== value.length + 1 || !names.includes('length')) return null;
    const entries: string[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const property = readOwnDataProperty(value, String(index));
      if (!property.found || typeof property.value !== 'string') return null;
      entries.push(property.value);
    }
    return Object.freeze(entries);
  } catch {
    return null;
  }
}

function readSnapshotArray(snapshot: unknown, key: StoreName): readonly unknown[] | null {
  if (!isPlainRecord(snapshot)) return null;
  const property = readOwnDataProperty(snapshot, key);
  if (!property.found || !Array.isArray(property.value)) return null;
  try {
    if (Object.getOwnPropertySymbols(property.value).length !== 0) return null;
    const names = Object.getOwnPropertyNames(property.value);
    if (names.length !== property.value.length + 1 || !names.includes('length')) return null;
    const values: unknown[] = [];
    for (let index = 0; index < property.value.length; index += 1) {
      const item = readOwnDataProperty(property.value, String(index));
      if (!item.found) return null;
      values.push(item.value);
    }
    return Object.freeze(values);
  } catch {
    return null;
  }
}

function createRecordStates(store: StoreName, values: readonly unknown[]): RecordState[] {
  return values.map((value, index) => ({
    store,
    index,
    value,
    identity: null,
    classification: 'invalid',
    invalidReason: null,
  }));
}

function setInvalidReason(state: RecordState, reason: InterruptedCoreV1InvalidReasonCode): void {
  state.invalidReason ??= reason;
}

function exactEmptyPlainRecord(value: unknown): boolean {
  return isPlainRecord(value) && hasExactOwnDataProperties(value, []);
}

function exactEmptyStringArray(value: unknown): boolean {
  const array = readExactStringArray(value);
  return array !== null && array.length === 0;
}

function validMetadata(value: unknown): value is PlainRecord {
  if (!isPlainRecord(value) || !hasOnlyOwnDataProperties(value)) return false;
  const name = readNonEmptyString(value, 'name');
  const description = readOwnDataProperty(value, 'description');
  const tags = readOwnDataProperty(value, 'tags');
  return (
    name !== null &&
    (!description.found ||
      typeof description.value === 'string' ||
      description.value === undefined) &&
    (!tags.found || readExactStringArray(tags.value) !== null)
  );
}

function exactDefaultMetadata(value: unknown, expectedName: string): boolean {
  if (!isPlainRecord(value) || !hasExactOwnDataProperties(value, ['name', 'description', 'tags'])) {
    return false;
  }
  const name = readOwnDataProperty(value, 'name');
  const description = readOwnDataProperty(value, 'description');
  const tags = readOwnDataProperty(value, 'tags');
  return (
    name.found &&
    name.value === expectedName &&
    description.found &&
    description.value === undefined &&
    tags.found &&
    exactEmptyStringArray(tags.value)
  );
}

function validExpanded(value: unknown): readonly string[] | null {
  if (value === true) return Object.freeze([]);
  if (!isPlainRecord(value) || !hasOnlyOwnDataProperties(value)) return null;
  try {
    const nodeIds: string[] = [];
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string' || key.length === 0) return null;
      const property = readOwnDataProperty(value, key);
      if (!property.found || typeof property.value !== 'boolean') return null;
      nodeIds.push(key);
    }
    return Object.freeze(nodeIds);
  } catch {
    return null;
  }
}

function defaultTreeName(treeId: string): string | null {
  return treeId === 'r' ? 'Resources' : treeId === 'p' ? 'Projects' : null;
}

function classifyTrees(states: RecordState[]): ParsedTree[] {
  const parsed: ParsedTree[] = [];
  for (const state of states) {
    if (!isPlainRecord(state.value) || !hasOnlyOwnDataProperties(state.value)) {
      setInvalidReason(state, 'record-shape');
      continue;
    }
    const id = readNonEmptyString(state.value, 'id');
    const name = readNonEmptyString(state.value, 'name');
    const rootId = readNonEmptyString(state.value, 'rootId');
    const archiveRootId = readNonEmptyString(state.value, 'archiveRootId');
    const superRootId = readNonEmptyString(state.value, 'superRootId');
    state.identity = id;
    if (id === null) {
      setInvalidReason(state, 'required-identity');
      continue;
    }
    if (name === null || rootId === null || archiveRootId === null || superRootId === null) {
      setInvalidReason(state, 'required-field-contract');
      continue;
    }
    const expectedName = defaultTreeName(id);
    if (expectedName === null) {
      state.classification = 'additional';
    } else {
      const exact =
        hasExactOwnDataProperties(state.value, [
          'id',
          'name',
          'superRootId',
          'rootId',
          'archiveRootId',
        ]) &&
        name === expectedName &&
        superRootId === `${id}:superRoot` &&
        rootId === `${id}:root` &&
        archiveRootId === `${id}:archive`;
      state.classification = exact ? 'exact-default' : 'modified-default-identity';
    }
    parsed.push({ state, id, rootId, archiveRootId, superRootId });
  }
  return parsed;
}

function classifyNodes(states: RecordState[]): ParsedNode[] {
  const parsed: ParsedNode[] = [];
  for (const state of states) {
    if (!isPlainRecord(state.value) || !hasOnlyOwnDataProperties(state.value)) {
      setInvalidReason(state, 'record-shape');
      continue;
    }
    const id = readNonEmptyString(state.value, 'id');
    const parentId = readNonEmptyString(state.value, 'parentId');
    const nodeType = readNonEmptyString(state.value, 'nodeType');
    const depth = readNonNegativeInteger(state.value, 'depth');
    const createdAt = readSafeTimestamp(state.value, 'createdAt');
    const updatedAt = readSafeTimestamp(state.value, 'updatedAt');
    const version = readNonNegativeInteger(state.value, 'version');
    const metadataProperty = readOwnDataProperty(state.value, 'metadata');
    const draftMetadataProperty = readOwnDataProperty(state.value, 'draftMetadata');
    const dataProperty = readOwnDataProperty(state.value, 'data');
    const draftDataProperty = readOwnDataProperty(state.value, 'draftData');
    const visibleProperty = readOwnDataProperty(state.value, 'visible');
    const referencesProperty = readOwnDataProperty(state.value, 'references');
    state.identity = id;
    const draftMetadataValid =
      !draftMetadataProperty.found ||
      draftMetadataProperty.value === undefined ||
      draftMetadataProperty.value === null ||
      validMetadata(draftMetadataProperty.value);
    const dataValid =
      !dataProperty.found ||
      dataProperty.value === undefined ||
      dataProperty.value === null ||
      isPlainRecord(dataProperty.value);
    const draftDataValid =
      !draftDataProperty.found ||
      draftDataProperty.value === undefined ||
      draftDataProperty.value === null ||
      isPlainRecord(draftDataProperty.value);
    const visibleValid = !visibleProperty.found || typeof visibleProperty.value === 'boolean';
    const references = !referencesProperty.found
      ? Object.freeze([])
      : readExactStringArray(referencesProperty.value);
    if (id === null) {
      setInvalidReason(state, 'required-identity');
      continue;
    }
    if (
      parentId === null ||
      nodeType === null ||
      depth === null ||
      createdAt === null ||
      updatedAt === null ||
      version === null ||
      !dataValid ||
      !draftDataValid ||
      !visibleValid ||
      references === null
    ) {
      setInvalidReason(state, 'required-field-contract');
      continue;
    }
    if (!metadataProperty.found || !validMetadata(metadataProperty.value) || !draftMetadataValid) {
      setInvalidReason(state, 'metadata-contract');
      continue;
    }
    if (!DEFAULT_NODE_IDENTITY_SET.has(id)) {
      state.classification = 'additional';
    } else {
      const treeId = id.slice(0, 1);
      const isArchive = id.endsWith(':archive');
      const expectedName = isArchive ? 'Archive' : defaultTreeName(treeId);
      const hasExactDraftMetadata = draftMetadataProperty.found
        ? draftMetadataProperty.value === null
        : false;
      const hasExactData = dataProperty.found ? dataProperty.value === null : false;
      const hasExactDraftData = draftDataProperty.found
        ? draftDataProperty.value === undefined
        : false;
      const exact =
        expectedName !== null &&
        hasExactOwnDataProperties(state.value, [
          'parentId',
          'id',
          'nodeType',
          'depth',
          'createdAt',
          'updatedAt',
          'version',
          'metadata',
          'draftMetadata',
          'data',
          'draftData',
        ]) &&
        parentId === `${treeId}:superRoot` &&
        nodeType === (isArchive ? 'archive' : 'folder') &&
        depth === 0 &&
        createdAt === updatedAt &&
        version === 1 &&
        exactDefaultMetadata(metadataProperty.value, expectedName) &&
        hasExactDraftMetadata &&
        hasExactData &&
        hasExactDraftData;
      state.classification = exact ? 'exact-default' : 'modified-default-identity';
    }
    parsed.push({ state, id, parentId, nodeType, references });
  }
  return parsed;
}

function classifyRootStates(states: RecordState[]): ParsedRootState[] {
  const parsed: ParsedRootState[] = [];
  for (const state of states) {
    if (!isPlainRecord(state.value) || !hasOnlyOwnDataProperties(state.value)) {
      setInvalidReason(state, 'record-shape');
      continue;
    }
    const rootNodeId = readNonEmptyString(state.value, 'rootNodeId');
    const treeId = readNonEmptyString(state.value, 'treeId');
    const expandedProperty = readOwnDataProperty(state.value, 'expanded');
    const expandedNodeIds = expandedProperty.found ? validExpanded(expandedProperty.value) : null;
    state.identity = rootNodeId;
    if (rootNodeId === null) {
      setInvalidReason(state, 'required-identity');
      continue;
    }
    if (treeId === null || expandedNodeIds === null) {
      setInvalidReason(state, 'required-field-contract');
      continue;
    }
    if (!DEFAULT_ROOT_STATE_IDENTITY_SET.has(rootNodeId)) {
      state.classification = 'additional';
    } else {
      const exact =
        hasExactOwnDataProperties(state.value, ['treeId', 'rootNodeId', 'expanded']) &&
        rootNodeId.startsWith(`${treeId}:`) &&
        expandedProperty.found &&
        exactEmptyPlainRecord(expandedProperty.value);
      state.classification = exact ? 'exact-default' : 'modified-default-identity';
    }
    parsed.push({ state, rootNodeId, treeId, expandedNodeIds });
  }
  return parsed;
}

function classifyTags(states: RecordState[]): ParsedTag[] {
  const parsed: ParsedTag[] = [];
  for (const state of states) {
    if (!isPlainRecord(state.value) || !hasOnlyOwnDataProperties(state.value)) {
      setInvalidReason(state, 'record-shape');
      continue;
    }
    const id = readNonEmptyString(state.value, 'id');
    const name = readNonEmptyString(state.value, 'name');
    const color = readNonEmptyString(state.value, 'color');
    const createdAt = readSafeTimestamp(state.value, 'createdAt');
    const description = readOwnDataProperty(state.value, 'description');
    state.identity = id;
    if (id === null) {
      setInvalidReason(state, 'required-identity');
      continue;
    }
    if (
      name === null ||
      color === null ||
      createdAt === null ||
      (description.found &&
        description.value !== undefined &&
        typeof description.value !== 'string')
    ) {
      setInvalidReason(state, 'required-field-contract');
      continue;
    }
    state.classification = 'additional';
    parsed.push({ state, id });
  }
  return parsed;
}

function classifyTagAssociations(states: RecordState[]): ParsedTagAssociation[] {
  const parsed: ParsedTagAssociation[] = [];
  for (const state of states) {
    if (!isPlainRecord(state.value) || !hasOnlyOwnDataProperties(state.value)) {
      setInvalidReason(state, 'record-shape');
      continue;
    }
    const id = readNonEmptyString(state.value, 'id');
    const nodeId = readNonEmptyString(state.value, 'nodeId');
    const tagId = readNonEmptyString(state.value, 'tagId');
    const scope = readNonEmptyString(state.value, 'scope');
    const assignedAt = readSafeTimestamp(state.value, 'assignedAt');
    const assignedBy = readOwnDataProperty(state.value, 'assignedBy');
    state.identity = id;
    if (id === null) {
      setInvalidReason(state, 'required-identity');
      continue;
    }
    if (
      nodeId === null ||
      tagId === null ||
      (scope !== 'draft' && scope !== 'published') ||
      assignedAt === null ||
      (assignedBy.found && assignedBy.value !== undefined && typeof assignedBy.value !== 'string')
    ) {
      setInvalidReason(state, 'required-field-contract');
      continue;
    }
    state.classification = 'additional';
    parsed.push({ state, id, nodeId, tagId });
  }
  return parsed;
}

function markDuplicateIdentitiesInvalid<T extends { readonly state: RecordState }>(
  values: readonly T[],
  identity: (value: T) => string
): boolean {
  let valid = true;
  const byIdentity = new Map<string, T[]>();
  for (const value of values) {
    const id = identity(value);
    const existing = byIdentity.get(id);
    if (existing === undefined) byIdentity.set(id, [value]);
    else existing.push(value);
  }
  for (const duplicates of byIdentity.values()) {
    if (duplicates.length < 2) continue;
    valid = false;
    for (const duplicate of duplicates) {
      duplicate.state.classification = 'invalid';
      setInvalidReason(duplicate.state, 'duplicate-identity');
    }
  }
  return valid;
}

function markStateInvalid(
  state: RecordState,
  reason: InterruptedCoreV1InvalidReasonCode = 'relationship-contract'
): false {
  state.classification = 'invalid';
  setInvalidReason(state, reason);
  return false;
}

function validateGraph(
  input: Readonly<{
    readonly trees: readonly ParsedTree[];
    readonly nodes: readonly ParsedNode[];
    readonly rootStates: readonly ParsedRootState[];
    readonly tags: readonly ParsedTag[];
    readonly tagAssociations: readonly ParsedTagAssociation[];
  }>
): boolean {
  let valid = true;
  valid = markDuplicateIdentitiesInvalid(input.trees, (tree) => tree.id) && valid;
  valid = markDuplicateIdentitiesInvalid(input.nodes, (node) => node.id) && valid;
  valid = markDuplicateIdentitiesInvalid(input.rootStates, (state) => state.rootNodeId) && valid;
  valid = markDuplicateIdentitiesInvalid(input.tags, (tag) => tag.id) && valid;
  valid =
    markDuplicateIdentitiesInvalid(input.tagAssociations, (association) => association.id) && valid;

  const trees = new Map(input.trees.map((tree) => [tree.id, tree] as const));
  const nodes = new Map(input.nodes.map((node) => [node.id, node] as const));
  const tags = new Map(input.tags.map((tag) => [tag.id, tag] as const));
  const virtualSuperRoots = new Set(input.trees.map((tree) => tree.superRootId));

  for (const tree of input.trees) {
    const root = nodes.get(tree.rootId);
    const archive = nodes.get(tree.archiveRootId);
    if (root === undefined || root.parentId !== tree.superRootId) {
      valid = markStateInvalid(tree.state);
      if (root !== undefined) markStateInvalid(root.state);
    }
    if (archive === undefined || archive.parentId !== tree.superRootId) {
      valid = markStateInvalid(tree.state);
      if (archive !== undefined) markStateInvalid(archive.state);
    }
  }

  for (const node of input.nodes) {
    if (!nodes.has(node.parentId) && !virtualSuperRoots.has(node.parentId)) {
      valid = markStateInvalid(node.state);
    }
    for (const reference of node.references) {
      if (!nodes.has(reference)) valid = markStateInvalid(node.state);
    }
    const seen = new Set<string>();
    let cursor: ParsedNode | undefined = node;
    while (cursor !== undefined && !virtualSuperRoots.has(cursor.parentId)) {
      if (seen.has(cursor.id)) {
        valid = markStateInvalid(node.state);
        break;
      }
      seen.add(cursor.id);
      cursor = nodes.get(cursor.parentId);
      if (cursor === undefined) break;
    }
  }

  for (const rootState of input.rootStates) {
    const tree = trees.get(rootState.treeId);
    const virtualDraftId = `${rootState.treeId}:draft`;
    if (
      tree === undefined ||
      !rootState.rootNodeId.startsWith(`${rootState.treeId}:`) ||
      (!nodes.has(rootState.rootNodeId) && rootState.rootNodeId !== virtualDraftId)
    ) {
      valid = markStateInvalid(rootState.state);
    }
    for (const expandedNodeId of rootState.expandedNodeIds) {
      if (!nodes.has(expandedNodeId) && expandedNodeId !== virtualDraftId) {
        valid = markStateInvalid(rootState.state);
      }
    }
  }

  for (const association of input.tagAssociations) {
    if (!nodes.has(association.nodeId) || !tags.has(association.tagId)) {
      valid = markStateInvalid(association.state);
    }
  }
  return valid;
}

function hasCompleteDefaultIdentitySet(states: readonly RecordState[]): boolean {
  const identities = new Set<string>();
  for (const state of states) {
    if (state.identity === null) continue;
    const isDefault =
      (state.store === 'trees' && DEFAULT_TREE_IDENTITY_SET.has(state.identity)) ||
      (state.store === 'nodes' && DEFAULT_NODE_IDENTITY_SET.has(state.identity)) ||
      (state.store === 'rootStates' && DEFAULT_ROOT_STATE_IDENTITY_SET.has(state.identity));
    if (isDefault) identities.add(`${state.store}:${state.identity}`);
  }
  return identities.size === EXPECTED_DEFAULT_IDENTITY_COUNT;
}

function isDefaultIdentity(state: RecordState): boolean {
  if (state.identity === null) return false;
  return (
    (state.store === 'trees' && DEFAULT_TREE_IDENTITY_SET.has(state.identity)) ||
    (state.store === 'nodes' && DEFAULT_NODE_IDENTITY_SET.has(state.identity)) ||
    (state.store === 'rootStates' && DEFAULT_ROOT_STATE_IDENTITY_SET.has(state.identity))
  );
}

function createEmptyReasonCounts(): Record<InterruptedCoreV1InvalidReasonCode, number> {
  return {
    'record-shape': 0,
    'required-identity': 0,
    'required-field-contract': 0,
    'metadata-contract': 0,
    'relationship-contract': 0,
    'duplicate-identity': 0,
    'yaml-contract': 0,
  };
}

function summarize(
  statesByStore: Readonly<Record<StoreName, readonly RecordState[]>>,
  nodes: readonly ParsedNode[],
  graphStatus: InterruptedCoreV1PreservationSummary['graphStatus'],
  yamlPlanningStatus: InterruptedCoreV1PreservationSummary['yamlPlanningStatus'],
  yamlSlotCounts: InterruptedCoreV1PreservationSummary['yamlSlotCounts']
): InterruptedCoreV1PreservationSummary {
  const allStates = STORE_NAMES.flatMap((store) => [...statesByStore[store]]);
  const classification = {
    exactDefault: 0,
    modifiedDefaultIdentity: 0,
    additional: 0,
    invalid: 0,
  };
  const invalidByStore = {
    trees: 0,
    nodes: 0,
    rootStates: 0,
    tags: 0,
    tagAssociations: 0,
    total: 0,
  };
  const invalidByReason = createEmptyReasonCounts();
  const invalidByIdentityClass = {
    defaultIdentity: 0,
    additionalIdentity: 0,
    unavailableIdentity: 0,
  };
  for (const state of allStates) {
    if (state.classification === 'exact-default') classification.exactDefault += 1;
    else if (state.classification === 'modified-default-identity') {
      classification.modifiedDefaultIdentity += 1;
    } else if (state.classification === 'additional') classification.additional += 1;
    else {
      classification.invalid += 1;
      invalidByStore[state.store] += 1;
      invalidByStore.total += 1;
      invalidByReason[state.invalidReason ?? 'record-shape'] += 1;
      if (state.identity === null) invalidByIdentityClass.unavailableIdentity += 1;
      else if (isDefaultIdentity(state)) invalidByIdentityClass.defaultIdentity += 1;
      else invalidByIdentityClass.additionalIdentity += 1;
    }
  }
  const additionalNodes = nodes.filter((node) => node.state.classification === 'additional');
  const storeCounts = {
    trees: statesByStore.trees.length,
    nodes: statesByStore.nodes.length,
    rootStates: statesByStore.rootStates.length,
    tags: statesByStore.tags.length,
    tagAssociations: statesByStore.tagAssociations.length,
    total: allStates.length,
  };
  return Object.freeze({
    storeCounts: Object.freeze(storeCounts),
    recordClassification: Object.freeze(classification),
    invalidDiagnostics: Object.freeze({
      byStore: Object.freeze(invalidByStore),
      byReason: Object.freeze(invalidByReason),
      byIdentityClass: Object.freeze(invalidByIdentityClass),
    }),
    additionalNodeCounts: Object.freeze({
      yaml: additionalNodes.filter((node) => node.nodeType === 'yaml-file').length,
      nonYaml: additionalNodes.filter((node) => node.nodeType !== 'yaml-file').length,
    }),
    graphStatus,
    yamlPlanningStatus,
    yamlSlotCounts,
  });
}

function summaryCountersAreConsistent(summary: InterruptedCoreV1PreservationSummary): boolean {
  const storeTotal = STORE_NAMES.reduce((total, store) => total + summary.storeCounts[store], 0);
  const classificationTotal =
    summary.recordClassification.exactDefault +
    summary.recordClassification.modifiedDefaultIdentity +
    summary.recordClassification.additional +
    summary.recordClassification.invalid;
  const invalidReasonTotal = Object.values(summary.invalidDiagnostics.byReason).reduce(
    (total, count) => total + count,
    0
  );
  const invalidIdentityTotal =
    summary.invalidDiagnostics.byIdentityClass.defaultIdentity +
    summary.invalidDiagnostics.byIdentityClass.additionalIdentity +
    summary.invalidDiagnostics.byIdentityClass.unavailableIdentity;
  return (
    summary.storeCounts.total === storeTotal &&
    summary.storeCounts.total === classificationTotal &&
    summary.invalidDiagnostics.byStore.total === summary.recordClassification.invalid &&
    summary.invalidDiagnostics.byStore.total ===
      summary.invalidDiagnostics.byStore.trees +
        summary.invalidDiagnostics.byStore.nodes +
        summary.invalidDiagnostics.byStore.rootStates +
        summary.invalidDiagnostics.byStore.tags +
        summary.invalidDiagnostics.byStore.tagAssociations &&
    STORE_NAMES.every(
      (store) => summary.invalidDiagnostics.byStore[store] <= summary.storeCounts[store]
    ) &&
    invalidReasonTotal === summary.recordClassification.invalid &&
    invalidIdentityTotal === summary.recordClassification.invalid &&
    summary.additionalNodeCounts.yaml + summary.additionalNodeCounts.nonYaml <=
      summary.recordClassification.additional
  );
}

function readExactCounterRecord<Key extends string>(
  value: unknown,
  names: readonly Key[]
): Readonly<Record<Key, number>> | null {
  if (!isPlainRecord(value) || !hasExactOwnDataProperties(value, names)) return null;
  const counters = {} as Record<Key, number>;
  for (const name of names) {
    const property = readOwnDataProperty(value, name);
    if (
      !property.found ||
      typeof property.value !== 'number' ||
      !Number.isSafeInteger(property.value) ||
      property.value < 0
    ) {
      return null;
    }
    counters[name] = property.value;
  }
  return Object.freeze(counters);
}

/** Rebuilds the exact public allowlist and rejects malformed or inconsistent counters. */
export function sanitizeInterruptedCoreV1PreservationSummary(
  value: unknown
): InterruptedCoreV1PreservationSummary | null {
  try {
    if (!isPlainRecord(value) || !hasExactOwnDataProperties(value, SUMMARY_PROPERTY_NAMES)) {
      return null;
    }
    const storeCountsProperty = readOwnDataProperty(value, 'storeCounts');
    const recordClassificationProperty = readOwnDataProperty(value, 'recordClassification');
    const invalidDiagnosticsProperty = readOwnDataProperty(value, 'invalidDiagnostics');
    const additionalNodeCountsProperty = readOwnDataProperty(value, 'additionalNodeCounts');
    const graphStatusProperty = readOwnDataProperty(value, 'graphStatus');
    const yamlPlanningStatusProperty = readOwnDataProperty(value, 'yamlPlanningStatus');
    const yamlSlotCountsProperty = readOwnDataProperty(value, 'yamlSlotCounts');
    if (
      !storeCountsProperty.found ||
      !recordClassificationProperty.found ||
      !invalidDiagnosticsProperty.found ||
      !additionalNodeCountsProperty.found ||
      !graphStatusProperty.found ||
      !yamlPlanningStatusProperty.found ||
      !yamlSlotCountsProperty.found
    ) {
      return null;
    }
    const storeCounts = readExactCounterRecord(storeCountsProperty.value, STORE_COUNT_NAMES);
    const recordClassification = readExactCounterRecord(
      recordClassificationProperty.value,
      RECORD_CLASSIFICATION_NAMES
    );
    const additionalNodeCounts = readExactCounterRecord(
      additionalNodeCountsProperty.value,
      ADDITIONAL_NODE_COUNT_NAMES
    );
    if (
      storeCounts === null ||
      recordClassification === null ||
      additionalNodeCounts === null ||
      !isPlainRecord(invalidDiagnosticsProperty.value) ||
      !hasExactOwnDataProperties(invalidDiagnosticsProperty.value, [
        'byStore',
        'byReason',
        'byIdentityClass',
      ])
    ) {
      return null;
    }
    const byStoreProperty = readOwnDataProperty(invalidDiagnosticsProperty.value, 'byStore');
    const byReasonProperty = readOwnDataProperty(invalidDiagnosticsProperty.value, 'byReason');
    const byIdentityClassProperty = readOwnDataProperty(
      invalidDiagnosticsProperty.value,
      'byIdentityClass'
    );
    if (!byStoreProperty.found || !byReasonProperty.found || !byIdentityClassProperty.found) {
      return null;
    }
    const byStore = readExactCounterRecord(byStoreProperty.value, STORE_COUNT_NAMES);
    const byReason = readExactCounterRecord(byReasonProperty.value, INVALID_REASON_CODES);
    const byIdentityClass = readExactCounterRecord(
      byIdentityClassProperty.value,
      INVALID_IDENTITY_CLASS_NAMES
    );
    if (byStore === null || byReason === null || byIdentityClass === null) return null;

    const graphStatus = graphStatusProperty.value;
    if (graphStatus !== 'not-evaluated' && graphStatus !== 'exact' && graphStatus !== 'invalid') {
      return null;
    }
    const yamlPlanningStatus = yamlPlanningStatusProperty.value;
    if (
      yamlPlanningStatus !== 'not-run' &&
      yamlPlanningStatus !== 'valid' &&
      yamlPlanningStatus !== 'invalid'
    ) {
      return null;
    }
    const yamlSlotCounts =
      yamlSlotCountsProperty.value === null
        ? null
        : readExactCounterRecord(yamlSlotCountsProperty.value, YAML_SLOT_COUNT_NAMES);
    if (yamlSlotCountsProperty.value !== null && yamlSlotCounts === null) return null;

    const summary: InterruptedCoreV1PreservationSummary = Object.freeze({
      storeCounts,
      recordClassification,
      invalidDiagnostics: Object.freeze({ byStore, byReason, byIdentityClass }),
      additionalNodeCounts,
      graphStatus,
      yamlPlanningStatus,
      yamlSlotCounts,
    });
    return summaryCountersAreConsistent(summary) ? summary : null;
  } catch {
    return null;
  }
}

function failed(
  code: Exclude<
    InterruptedCoreV1PreservationClassificationCode,
    'INTERRUPTED_CORE_V1_PRESERVATION_ACCEPTED'
  >,
  summary?: InterruptedCoreV1PreservationSummary
): InterruptedCoreV1PreservationClassificationResult {
  return Object.freeze({ ok: false, code, ...(summary === undefined ? {} : { summary }) });
}

/** Classifies a fixed logical-v1 snapshot without mutating or exposing any record value. */
export async function classifyInterruptedCoreV1Snapshot(
  input: ClassifyInterruptedCoreV1SnapshotInput
): Promise<InterruptedCoreV1PreservationClassificationResult> {
  try {
    if (typeof input.digestSha256Hex !== 'function') {
      return failed('INTERRUPTED_CORE_V1_PRESERVATION_SNAPSHOT_INVALID');
    }
    const snapshot = input.snapshot as unknown;
    if (!isPlainRecord(snapshot) || !hasExactOwnDataProperties(snapshot, STORE_NAMES)) {
      return failed('INTERRUPTED_CORE_V1_PRESERVATION_SNAPSHOT_INVALID');
    }
    const valuesByStore = {} as Record<StoreName, readonly unknown[]>;
    for (const store of STORE_NAMES) {
      const values = readSnapshotArray(snapshot, store);
      if (values === null) return failed('INTERRUPTED_CORE_V1_PRESERVATION_SNAPSHOT_INVALID');
      valuesByStore[store] = values;
    }
    const statesByStore: Record<StoreName, RecordState[]> = {
      trees: createRecordStates('trees', valuesByStore.trees),
      nodes: createRecordStates('nodes', valuesByStore.nodes),
      rootStates: createRecordStates('rootStates', valuesByStore.rootStates),
      tags: createRecordStates('tags', valuesByStore.tags),
      tagAssociations: createRecordStates('tagAssociations', valuesByStore.tagAssociations),
    };
    const trees = classifyTrees(statesByStore.trees);
    const nodes = classifyNodes(statesByStore.nodes);
    const rootStates = classifyRootStates(statesByStore.rootStates);
    const tags = classifyTags(statesByStore.tags);
    const tagAssociations = classifyTagAssociations(statesByStore.tagAssociations);
    let summary = sanitizeInterruptedCoreV1PreservationSummary(
      summarize(statesByStore, nodes, 'not-evaluated', 'not-run', null)
    );
    if (summary === null) {
      return failed('INTERRUPTED_CORE_V1_PRESERVATION_INTERNAL_FAILED');
    }
    if (summary.recordClassification.invalid > 0) {
      return failed('INTERRUPTED_CORE_V1_PRESERVATION_SNAPSHOT_INVALID', summary);
    }
    const graphValid = validateGraph({ trees, nodes, rootStates, tags, tagAssociations });
    const graphAccepted =
      graphValid &&
      hasCompleteDefaultIdentitySet(STORE_NAMES.flatMap((store) => statesByStore[store]));
    summary = sanitizeInterruptedCoreV1PreservationSummary(
      summarize(statesByStore, nodes, graphAccepted ? 'exact' : 'invalid', 'not-run', null)
    );
    if (summary === null) {
      return failed('INTERRUPTED_CORE_V1_PRESERVATION_INTERNAL_FAILED');
    }
    if (!graphAccepted) {
      return failed('INTERRUPTED_CORE_V1_PRESERVATION_GRAPH_INVALID', summary);
    }

    const yamlNodes = nodes.filter((node) => node.nodeType === 'yaml-file');
    const planning = await planYamlCoreDbMigration({
      migrationId: 'interrupted-core-v1-preservation-classification',
      fromCoreDbVersion: CORE_DB_LEGACY_LOGICAL_VERSION,
      toCoreDbVersion: CORE_DB_CANONICAL_LOGICAL_VERSION,
      rawNodes: Object.freeze(yamlNodes.map((node) => node.state.value)),
      digestSha256Hex: input.digestSha256Hex,
    });
    if (planning.ok === false) {
      const invalidIndexes = new Set(
        planning.errors
          .map((error) => error.sourceIndex)
          .filter(
            (sourceIndex): sourceIndex is number =>
              Number.isSafeInteger(sourceIndex) && sourceIndex >= 0
          )
      );
      for (const sourceIndex of invalidIndexes) {
        const invalidNode = yamlNodes[sourceIndex];
        if (invalidNode !== undefined) {
          invalidNode.state.classification = 'invalid';
          setInvalidReason(invalidNode.state, 'yaml-contract');
        }
      }
      summary = sanitizeInterruptedCoreV1PreservationSummary(
        summarize(statesByStore, nodes, 'exact', 'invalid', null)
      );
      if (summary === null) {
        return failed('INTERRUPTED_CORE_V1_PRESERVATION_INTERNAL_FAILED');
      }
      return failed('INTERRUPTED_CORE_V1_PRESERVATION_YAML_INVALID', summary);
    }
    const yamlSlotCounts = {
      canonical: 0,
      legacyWithName: 0,
      hostSplitLegacy: 0,
      temporaryPlaceholder: 0,
      metadataOnlyDraft: 0,
    };
    for (const entry of planning.plan.entries) {
      if (entry.action === 'migrate') {
        if (entry.preimageRepresentation === 'legacy-with-name') {
          yamlSlotCounts.legacyWithName += 1;
        } else {
          yamlSlotCounts.hostSplitLegacy += 1;
        }
      } else if (entry.reason === 'canonical') yamlSlotCounts.canonical += 1;
      else if (entry.reason === 'temporary-placeholder') {
        yamlSlotCounts.temporaryPlaceholder += 1;
      } else yamlSlotCounts.metadataOnlyDraft += 1;
    }
    summary = sanitizeInterruptedCoreV1PreservationSummary(
      summarize(statesByStore, nodes, 'exact', 'valid', Object.freeze(yamlSlotCounts))
    );
    if (summary === null) {
      return failed('INTERRUPTED_CORE_V1_PRESERVATION_INTERNAL_FAILED');
    }
    return Object.freeze({
      ok: true,
      code: 'INTERRUPTED_CORE_V1_PRESERVATION_ACCEPTED',
      summary,
    });
  } catch {
    return failed('INTERRUPTED_CORE_V1_PRESERVATION_INTERNAL_FAILED');
  }
}
