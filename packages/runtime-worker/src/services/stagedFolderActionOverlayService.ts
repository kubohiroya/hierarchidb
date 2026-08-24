import type { NodeId, Timestamp } from '@hierarchidb/core-types';
import type { NodePayload, TreeNode } from '@hierarchidb/tree-api';
import type { CoreDB } from './CoreDB.js';
import { strictMergeNodePayload } from './effectiveTreeNodeDataResolver.js';
import { isTemporaryFolderHolderNode } from './temporaryFolderHolderLifecycle.js';

export type StagedFolderActionOverlayStagingMode =
  | 'temporary-copy'
  | 'permanent-copy'
  | 'patch-source';

export interface StagedFolderActionOverlayEntry {
  match: {
    path: string;
  };
  data: Record<string, unknown>;
}

export interface ApplyStagedFolderActionOverlaysInput {
  stagingMode: StagedFolderActionOverlayStagingMode;
  stagingRootNodeId: NodeId;
  nodes: readonly StagedFolderActionOverlayEntry[];
}

export type StagedFolderActionOverlayApplicationErrorCode =
  | 'STAGED_FOLDER_ACTION_OVERLAY_STAGING_ROOT_NOT_FOUND'
  | 'STAGED_FOLDER_ACTION_OVERLAY_INVALID_PATH'
  | 'STAGED_FOLDER_ACTION_OVERLAY_DUPLICATE_PATH'
  | 'STAGED_FOLDER_ACTION_OVERLAY_PATH_NOT_FOUND'
  | 'STAGED_FOLDER_ACTION_OVERLAY_DUPLICATE_SIBLING_NAME'
  | 'STAGED_FOLDER_ACTION_OVERLAY_TARGET_IS_TEMPORARY_HOLDER'
  | 'STAGED_FOLDER_ACTION_OVERLAY_TARGET_NOT_COPY_ON_WRITE'
  | 'STAGED_FOLDER_ACTION_OVERLAY_TARGET_HAS_PATCH_WITHOUT_COW'
  | 'STAGED_FOLDER_ACTION_OVERLAY_UNSUPPORTED_OPERATION'
  | 'STAGED_FOLDER_ACTION_OVERLAY_DATA_NOT_OBJECT';

export class StagedFolderActionOverlayApplicationError extends Error {
  readonly code: StagedFolderActionOverlayApplicationErrorCode;
  readonly path: string;
  readonly nodeId?: NodeId;

  constructor(
    code: StagedFolderActionOverlayApplicationErrorCode,
    message: string,
    context: { path: string; nodeId?: NodeId }
  ) {
    super(message);
    this.name = 'StagedFolderActionOverlayApplicationError';
    this.code = code;
    this.path = context.path;
    this.nodeId = context.nodeId;
  }
}

export async function applyStagedFolderActionOverlays(
  coreDB: CoreDB,
  input: ApplyStagedFolderActionOverlaysInput
): Promise<void> {
  const stagingRoot = await coreDB.getNode(input.stagingRootNodeId);
  if (!stagingRoot) {
    throw overlayError(
      'STAGED_FOLDER_ACTION_OVERLAY_STAGING_ROOT_NOT_FOUND',
      '<staging-root>',
      `Staging root ${input.stagingRootNodeId} was not found`,
      input.stagingRootNodeId
    );
  }
  assertNotTemporaryHolder(stagingRoot, '<staging-root>');

  const seenPaths = new Set<string>();
  for (const entry of input.nodes) {
    assertSafeOverlayPath(entry.match.path);
    assertSupportedPatchData(entry.data, entry.match.path);
    if (seenPaths.has(entry.match.path)) {
      throw overlayError(
        'STAGED_FOLDER_ACTION_OVERLAY_DUPLICATE_PATH',
        entry.match.path,
        `Duplicate overlay path ${entry.match.path}`
      );
    }
    seenPaths.add(entry.match.path);
  }

  for (const entry of input.nodes) {
    const target = await resolveOverlayTarget(coreDB, stagingRoot, entry.match.path);
    assertNotTemporaryHolder(target, entry.match.path);
    if (input.stagingMode === 'patch-source') {
      await applyPatchSourceOverlay(coreDB, target, entry);
    } else {
      await applyCopyOnWriteOverlay(coreDB, target, entry);
    }
  }
}

async function resolveOverlayTarget(
  coreDB: CoreDB,
  stagingRoot: TreeNode,
  path: string
): Promise<TreeNode<NodePayload | null>> {
  const segments = path.split('/');
  let current = stagingRoot as TreeNode<NodePayload | null>;
  if (path === '.') {
    return current;
  }

  for (const segment of segments) {
    const children = await coreDB.listChildren(current.id as NodeId);
    const matches = children.filter((child) => child.metadata.name === segment);
    if (matches.length === 0) {
      if (segments.length === 1 && current.metadata.name === segment) {
        return current;
      }
      throw overlayError(
        'STAGED_FOLDER_ACTION_OVERLAY_PATH_NOT_FOUND',
        path,
        `Overlay path ${path} was not found under staging root`,
        current.id as NodeId
      );
    }
    if (matches.length > 1) {
      throw overlayError(
        'STAGED_FOLDER_ACTION_OVERLAY_DUPLICATE_SIBLING_NAME',
        path,
        `Duplicate sibling display name ${segment} under node ${current.id}`,
        current.id as NodeId
      );
    }
    current = matches[0] as TreeNode<NodePayload | null>;
  }

  return current;
}

async function applyCopyOnWriteOverlay(
  coreDB: CoreDB,
  target: TreeNode<NodePayload | null>,
  entry: StagedFolderActionOverlayEntry
): Promise<void> {
  if (target.copyOnWriteOf === undefined) {
    throw overlayError(
      target.patchData === undefined
        ? 'STAGED_FOLDER_ACTION_OVERLAY_TARGET_NOT_COPY_ON_WRITE'
        : 'STAGED_FOLDER_ACTION_OVERLAY_TARGET_HAS_PATCH_WITHOUT_COW',
      entry.match.path,
      `Overlay target ${target.id} is not a valid copy-on-write node`,
      target.id
    );
  }

  const basePatch = normalizePayload(target.patchData, entry.match.path);
  await coreDB.updateNode({
    id: target.id,
    patchData: strictMergeNodePayload(basePatch, entry.data),
    updatedAt: Date.now() as Timestamp,
    version: target.version + 1,
  });
}

async function applyPatchSourceOverlay(
  coreDB: CoreDB,
  target: TreeNode<NodePayload | null>,
  entry: StagedFolderActionOverlayEntry
): Promise<void> {
  const baseData = normalizePayload(target.data, entry.match.path);
  await coreDB.updateNode({
    id: target.id,
    data: strictMergeNodePayload(baseData, entry.data),
    updatedAt: Date.now() as Timestamp,
    version: target.version + 1,
  });
}

function assertSafeOverlayPath(path: string): void {
  if (path === '.') {
    return;
  }
  if (
    path.length === 0 ||
    path.startsWith('/') ||
    path.includes('\0') ||
    path.split('/').some((segment) => segment.length === 0 || segment === '..' || segment === '.')
  ) {
    throw overlayError(
      'STAGED_FOLDER_ACTION_OVERLAY_INVALID_PATH',
      path,
      'Expected a staging-root-relative path without empty, current-directory, or parent-directory segments'
    );
  }
}

function assertSupportedPatchData(data: Record<string, unknown>, path: string): void {
  if (!isPlainRecord(data)) {
    throw overlayError(
      'STAGED_FOLDER_ACTION_OVERLAY_DATA_NOT_OBJECT',
      path,
      'Overlay data must be an object payload'
    );
  }
  for (const key of Object.keys(data)) {
    if (key.startsWith('$')) {
      throw overlayError(
        'STAGED_FOLDER_ACTION_OVERLAY_UNSUPPORTED_OPERATION',
        path,
        `Unsupported overlay operation key ${key}`
      );
    }
  }
}

function normalizePayload(value: unknown, path: string): NodePayload | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (!isPlainRecord(value)) {
    throw overlayError(
      'STAGED_FOLDER_ACTION_OVERLAY_DATA_NOT_OBJECT',
      path,
      'Existing target data must be an object payload'
    );
  }
  return value;
}

function assertNotTemporaryHolder(node: TreeNode | undefined, path: string): void {
  if (isTemporaryFolderHolderNode(node)) {
    throw overlayError(
      'STAGED_FOLDER_ACTION_OVERLAY_TARGET_IS_TEMPORARY_HOLDER',
      path,
      'Overlay cannot target the temporary-folder holder',
      node?.id as NodeId | undefined
    );
  }
}

function overlayError(
  code: StagedFolderActionOverlayApplicationErrorCode,
  path: string,
  message: string,
  nodeId?: NodeId
): StagedFolderActionOverlayApplicationError {
  return new StagedFolderActionOverlayApplicationError(code, message, { path, nodeId });
}

function isPlainRecord(value: unknown): value is NodePayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}
