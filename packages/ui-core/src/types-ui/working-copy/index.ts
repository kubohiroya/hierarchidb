/**
 * @file Working Copy Types (Deprecated Stubs)
 * @description These are stub types to support deprecated WorkingCopy commands
 * @deprecated These types are only kept for backward compatibility
 */

export interface IWorkingCopy {
  nodeId: string;
  commit: (options?: CommitOptions) => Promise<CommitResult>;
  discard: (options?: DiscardOptions) => Promise<void>;
  getChanges: () => Promise<WorkingCopyChange[]>;
}

export interface CommitOptions {
  skipValidation?: boolean;
}

export interface CommitResult {
  success: boolean;
  nodeId: string;
  newVersion: number;
}

export interface DiscardOptions {
  force?: boolean;
  cleanup?: boolean;
}

export interface WorkingCopyChange {
  type: 'add' | 'update' | 'delete';
  key: string;
  oldValue?: unknown;
  newValue?: unknown;
}
