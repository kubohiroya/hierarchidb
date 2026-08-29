export type IdeGsmMountSourceKind = 'fdm-space-root' | 'project-root';

export interface IdeGsmMountCapabilities extends Record<string, unknown> {
  read: true;
  remove?: boolean;
  sim?: boolean;
}

export interface IdeGsmMountDescriptor extends Record<string, unknown> {
  mountKind: 'ide-gsm';
  sourceKind: IdeGsmMountSourceKind;
  mountId: string;
  displayName: string;
  rootPath: string;
  capabilities: IdeGsmMountCapabilities;
  projectId?: string;
  spaceId?: string;
}

export interface IdeGsmMountedNodeReference extends Record<string, unknown> {
  mountKind: 'ide-gsm';
  mountId: string;
  sourceKind: IdeGsmMountSourceKind;
  relativePath: string;
  projectId?: string;
  spaceId?: string;
}

export interface IdeGsmDirectoryNode {
  name: string;
  relativePath: string;
  kind: string;
  directory: boolean;
  exists: boolean;
  sizeBytes: number;
  updatedAt: string | null;
  childCount: number;
  children: IdeGsmDirectoryNode[];
}

export interface IdeGsmDirectoryTreeReport {
  selectedPath: string;
  maxDepth: number;
  root: IdeGsmDirectoryNode;
}

export interface IdeGsmDirectoryInfoReport {
  requestedPath: string;
  descendantCount: number;
  node: IdeGsmDirectoryNode;
}

export interface IdeGsmProjectDirectoryTreeReport extends IdeGsmDirectoryTreeReport {
  projectRelativePath: string;
}

export interface IdeGsmProjectDirectoryInfoReport extends IdeGsmDirectoryInfoReport {
  projectRelativePath: string;
}

export interface IdeGsmFdmDirectoryTreeInput {
  spaceId?: string;
  path?: string;
  depth?: number;
}

export interface IdeGsmFdmDirectoryInfoInput {
  spaceId?: string;
  path?: string;
  depth?: number;
}

export interface IdeGsmFdmDirectoryRemoveInput {
  spaceId: string;
  path: string;
  apply: boolean;
}

export interface IdeGsmFdmDirectoryRemoveReport {
  targetPath: string;
  apply: boolean;
  existed: boolean;
  deleted: boolean;
  deletedFiles: number;
  deletedBytes: number;
  target: IdeGsmDirectoryNode;
}

export interface IdeGsmFdmSpace {
  spaceId: string;
}

export interface IdeGsmFdmSpacesReport {
  defaultSpaceId: string;
  spaces: IdeGsmFdmSpace[];
}

export interface IdeGsmProjectDirectoryInput {
  projectRelativePath: string;
  path?: string;
  depth?: number;
}

export const IDE_GSM_MOUNT_NODE_ID_PREFIX = 'ide-gsm:';

export function encodeIdeGsmMountedNodeId(mountId: string, relativePath: string): string {
  assertMountId(mountId);
  assertLogicalPath(relativePath, 'relativePath', true);
  return `${IDE_GSM_MOUNT_NODE_ID_PREFIX}${encodeURIComponent(mountId)}:${encodeURIComponent(relativePath)}`;
}

export function decodeIdeGsmMountedNodeId(
  nodeId: string
): { mountId: string; relativePath: string } | null {
  if (!nodeId.startsWith(IDE_GSM_MOUNT_NODE_ID_PREFIX)) {
    return null;
  }
  const body = nodeId.slice(IDE_GSM_MOUNT_NODE_ID_PREFIX.length);
  const separator = body.indexOf(':');
  if (separator < 0) {
    return null;
  }
  const mountId = decodeURIComponent(body.slice(0, separator));
  const relativePath = decodeURIComponent(body.slice(separator + 1));
  assertMountId(mountId);
  assertLogicalPath(relativePath, 'relativePath', true);
  return { mountId, relativePath };
}

export function isIdeGsmMountedNodeId(nodeId: string): boolean {
  return decodeIdeGsmMountedNodeId(nodeId) !== null;
}

export function assertIdeGsmMountDescriptor(
  value: unknown
): asserts value is IdeGsmMountDescriptor {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('IDE-GSM mount descriptor must be an object');
  }
  const record = value as Record<string, unknown>;
  const forbidden = [
    'endpoint',
    'endpointUrl',
    'graphqlUrl',
    'token',
    'jwt',
    'authToken',
    'absolutePath',
    'content',
  ];
  for (const key of forbidden) {
    if (Object.hasOwn(record, key)) {
      throw new Error(`IDE-GSM mount descriptor must not contain ${key}`);
    }
  }
  if (record.mountKind !== 'ide-gsm') {
    throw new Error('IDE-GSM mount descriptor must use mountKind ide-gsm');
  }
  if (record.sourceKind !== 'fdm-space-root' && record.sourceKind !== 'project-root') {
    throw new Error('IDE-GSM mount descriptor sourceKind is invalid');
  }
  assertString(record.mountId, 'mountId');
  assertMountId(record.mountId);
  assertString(record.displayName, 'displayName');
  assertOptionalLogicalPath(record.rootPath, 'rootPath', true);
  assertCapabilities(record.capabilities);
  if (record.sourceKind === 'project-root') {
    assertString(record.projectId, 'projectId');
    assertProjectRelativePath(record.projectId);
    if (record.spaceId !== undefined) {
      throw new Error('IDE-GSM project-root descriptor must not contain spaceId');
    }
  }
  if (record.sourceKind === 'fdm-space-root') {
    assertString(record.spaceId, 'spaceId');
    if (record.projectId !== undefined) {
      throw new Error('IDE-GSM fdm-space-root descriptor must not contain projectId');
    }
  }
}

export function assertProjectRelativePath(projectRelativePath: string): void {
  assertString(projectRelativePath, 'projectRelativePath');
  assertLogicalPath(projectRelativePath, 'projectRelativePath', false);
}

export function assertLogicalPath(value: string, fieldName: string, allowEmpty: boolean): void {
  const trimmed = value.trim();
  const segments = trimmed.split(/[\\/]/u);
  const isWindowsAbsolute = /^[A-Za-z]:[\\/]/u.test(trimmed);
  if (
    (!allowEmpty && trimmed.length === 0) ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('\\') ||
    isWindowsAbsolute ||
    segments.includes('..')
  ) {
    throw new Error(`${fieldName} must be a relative logical path without parent traversal`);
  }
}

function assertMountId(mountId: string): void {
  assertString(mountId, 'mountId');
  if (mountId.trim() !== mountId || mountId.length === 0 || mountId.includes('/')) {
    throw new Error('mountId must be a stable non-empty identifier');
  }
}

function assertString(value: unknown, fieldName: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${fieldName} must be a non-empty string`);
  }
}

function assertOptionalLogicalPath(value: unknown, fieldName: string, allowEmpty: boolean): void {
  if (value === undefined) {
    return;
  }
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string`);
  }
  assertLogicalPath(value, fieldName, allowEmpty);
}

function assertCapabilities(value: unknown): asserts value is IdeGsmMountCapabilities {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('IDE-GSM mount descriptor capabilities must be an object');
  }
  const capabilities = value as Record<string, unknown>;
  if (capabilities.read !== true) {
    throw new Error('IDE-GSM mount descriptor requires read capability');
  }
  for (const key of ['remove', 'sim']) {
    if (capabilities[key] !== undefined && typeof capabilities[key] !== 'boolean') {
      throw new Error(`IDE-GSM mount descriptor ${key} capability must be boolean`);
    }
  }
}
