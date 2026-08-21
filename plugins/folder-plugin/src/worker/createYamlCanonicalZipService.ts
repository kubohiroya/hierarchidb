import type { NodeId } from '@hierarchidb/core-types';
import type {
  ExportYamlCanonicalZipInput,
  ExportYamlCanonicalZipResult,
  ImportYamlCanonicalZipInput,
  ImportYamlCanonicalZipResult,
  YamlCanonicalZipAPI,
  YamlCanonicalZipErrorCode,
  YamlCanonicalZipExportSlot,
  YamlCanonicalZipImportTransactionRequest,
  YamlCanonicalZipServiceEnvironment,
} from '@hierarchidb/worker-api';
import { decodeCanonicalYamlZip } from '../canonical-yaml-zip-codec/index.js';
import {
  commitCanonicalYamlZipImportPlan,
  planCanonicalYamlZipExport,
  planCanonicalYamlZipImport,
} from '../canonical-yaml-zip-plan/index.js';

type ParsedExportInput = Readonly<{
  readonly parentId: NodeId;
  readonly slot: YamlCanonicalZipExportSlot;
}>;

type ParsedImportInput = Readonly<{
  readonly parentId: NodeId;
  readonly archiveBase64: string;
}>;

function failure(
  code: YamlCanonicalZipErrorCode
): Readonly<{ readonly ok: false; readonly code: YamlCanonicalZipErrorCode }> {
  return Object.freeze({ ok: false, code });
}

function readExactInput(
  input: unknown,
  expectedKeys: readonly string[]
): Readonly<Record<string, unknown>> | null {
  try {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) return null;
    const prototype = Object.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(input);
    const expected = new Set<PropertyKey>(expectedKeys);
    if (keys.length !== expected.size || keys.some((key) => !expected.has(key))) return null;
    const values: Record<string, unknown> = {};
    for (const key of expectedKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (descriptor === undefined || !Object.hasOwn(descriptor, 'value')) return null;
      values[key] = descriptor.value;
    }
    return values;
  } catch {
    return null;
  }
}

function readOwnValue(input: unknown, key: string): unknown {
  try {
    if (typeof input !== 'object' || input === null) return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    return descriptor !== undefined && Object.hasOwn(descriptor, 'value')
      ? descriptor.value
      : undefined;
  } catch {
    return undefined;
  }
}

function parseExportInput(input: unknown): ParsedExportInput | null {
  const values = readExactInput(input, ['parentId', 'slot']);
  if (values === null) return null;
  if (typeof values.parentId !== 'string' || values.parentId.length === 0) return null;
  if (values.slot !== 'committed' && values.slot !== 'draft') return null;
  return Object.freeze({ parentId: values.parentId as NodeId, slot: values.slot });
}

function parseImportInput(input: unknown): ParsedImportInput | null {
  const values = readExactInput(input, ['parentId', 'archiveBase64']);
  if (values === null) return null;
  if (typeof values.parentId !== 'string' || values.parentId.length === 0) return null;
  if (typeof values.archiveBase64 !== 'string' || values.archiveBase64.length === 0) return null;
  return Object.freeze({
    parentId: values.parentId as NodeId,
    archiveBase64: values.archiveBase64,
  });
}

class YamlCanonicalZipService implements YamlCanonicalZipAPI {
  constructor(private readonly environment: YamlCanonicalZipServiceEnvironment) {}

  async exportYamlCanonicalZip(
    input: ExportYamlCanonicalZipInput
  ): Promise<ExportYamlCanonicalZipResult> {
    try {
      this.environment.assertCanonicalAccess();
    } catch {
      return failure('ACCESS_DENIED');
    }
    const parsed = parseExportInput(input);
    if (parsed === null) return failure('INVALID_INPUT');
    const snapshot = await this.environment.coreDB.readFolderSnapshot(parsed.parentId);
    if (snapshot.parent === undefined) return failure('PARENT_NOT_FOUND');
    if (readOwnValue(snapshot.parent, 'nodeType') !== 'folder') return failure('PARENT_NOT_FOLDER');
    const nodes = snapshot.children.filter(
      (node) => readOwnValue(node, 'nodeType') === 'yaml-file'
    );
    const planned = planCanonicalYamlZipExport({ slot: parsed.slot, nodes });
    if (!planned.ok) return failure('EXPORT_PLAN_REJECTED');
    return Object.freeze({
      ok: true,
      archiveBase64: planned.plan.archive.base64,
      byteLength: planned.plan.archive.bytes.byteLength,
      nodeIds: Object.freeze(planned.plan.nodeGuards.map((guard) => guard.nodeId as NodeId)),
    });
  }

  async importYamlCanonicalZip(
    input: ImportYamlCanonicalZipInput
  ): Promise<ImportYamlCanonicalZipResult> {
    try {
      this.environment.assertCanonicalAccess();
    } catch {
      return failure('ACCESS_DENIED');
    }
    const parsed = parseImportInput(input);
    if (parsed === null) return failure('INVALID_INPUT');
    const decoded = decodeCanonicalYamlZip(parsed.archiveBase64);
    if (!decoded.ok || decoded.value.entries.length === 0) {
      return failure('IMPORT_PLAN_REJECTED');
    }

    let generatedNodeIds: readonly NodeId[];
    let timestamp: number;
    try {
      generatedNodeIds = Object.freeze(
        decoded.value.entries.map(() => this.environment.generateNodeId())
      );
      timestamp = this.environment.now();
    } catch {
      return failure('IMPORT_PLAN_REJECTED');
    }
    const snapshot = await this.environment.coreDB.readFolderSnapshot(parsed.parentId);
    if (snapshot.parent === undefined) return failure('PARENT_NOT_FOUND');
    if (readOwnValue(snapshot.parent, 'nodeType') !== 'folder') return failure('PARENT_NOT_FOLDER');

    const planned = planCanonicalYamlZipImport({
      archive: parsed.archiveBase64,
      parent: snapshot.parent,
      siblings: snapshot.children,
      existingNodeIds: snapshot.existingNodeIds,
      generatedNodeIds,
      timestamp,
    });
    if (!planned.ok) return failure('IMPORT_PLAN_REJECTED');

    const committed = await commitCanonicalYamlZipImportPlan(
      planned.plan,
      async (request: YamlCanonicalZipImportTransactionRequest) => {
        await this.environment.coreDB.commitImport(request);
      }
    );
    if (!committed.ok) return failure('IMPORT_TRANSACTION_REJECTED');
    return Object.freeze({
      ok: true,
      nodeIds: Object.freeze(planned.plan.request.nodes.map((node) => node.id as NodeId)),
    });
  }
}

/** Creates the production canonical ZIP API around the runtime-owned CoreDB port. */
export function createYamlCanonicalZipService(
  environment: YamlCanonicalZipServiceEnvironment
): YamlCanonicalZipAPI {
  return new YamlCanonicalZipService(environment);
}
