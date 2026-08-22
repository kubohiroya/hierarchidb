import type {
  ImportData as ImportDataBase,
  ImportProgress,
  ImportValidationResult,
} from '@hierarchidb/import-export-api';
import type { TreeNodeData } from '@hierarchidb/tree-api';

export type ImportData = ImportDataBase<TreeNodeData>;
export type { ImportProgress, ImportValidationResult };
