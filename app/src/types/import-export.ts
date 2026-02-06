import type { TreeNodeData } from '@hierarchidb/tree-api';
import type {
  ImportData as ImportDataBase,
  ImportProgress,
  ImportValidationResult,
} from '@hierarchidb/import-export-api';

export type ImportData = ImportDataBase<TreeNodeData>;
export type { ImportProgress, ImportValidationResult };
