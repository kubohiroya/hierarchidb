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

export function assertProjectRelativePath(projectRelativePath: string): void {
  assertString(projectRelativePath, 'projectRelativePath');
  assertLogicalPath(projectRelativePath, 'projectRelativePath', false);
}

export function assertLogicalPath(value: string, fieldName: string, allowEmpty: boolean): void {
  const trimmed = value.trim();
  const segments = trimmed.split(/[\\/]/u);
  const isWindowsAbsolute = /^[A-Za-z]:[\\/]/u.test(trimmed);
  if (
    trimmed !== value ||
    (!allowEmpty && trimmed.length === 0) ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('\\') ||
    isWindowsAbsolute ||
    segments.includes('..')
  ) {
    throw new Error(`${fieldName} must be a relative logical path without parent traversal`);
  }
}

function assertString(value: unknown, fieldName: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${fieldName} must be a non-empty string`);
  }
}
