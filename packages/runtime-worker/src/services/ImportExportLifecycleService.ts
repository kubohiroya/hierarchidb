import type { ImportNodesParams, ImportResult } from '@hierarchidb/import-export-api';
import type { Timestamp } from '@hierarchidb/core-types';
import type { CommandEnvelope, ImportNodesPayload, TreeNodeData } from '@hierarchidb/tree-api';
import type { ImportExportDBPort } from '@hierarchidb/import-export';
import { ImportExportService as BaseImportExportService } from '@hierarchidb/import-export';
import { SingletonMixin } from '@hierarchidb/util';
import { EntityLifecycleManager } from '../entity/EntityLifecycleManager.js';
import type { CoreDB } from './CoreDB.js';

// Augment base ImportExportService with lifecycle notifications.
export class ImportExportLifecycleService<T = TreeNodeData> extends BaseImportExportService<T> {
  private readonly coreDB: CoreDB | null;

  static async getSingleton<T = TreeNodeData>(
    db: ImportExportDBPort
  ): Promise<ImportExportLifecycleService<T>> {
    return SingletonMixin.getSingleton(
      'ImportExportLifecycleService',
      () => new ImportExportLifecycleService(db)
    );
  }

  private constructor(db: ImportExportDBPort) {
    super(db);
    const adapter = db as { getCoreDB?: () => CoreDB };
    this.coreDB = typeof adapter.getCoreDB === 'function' ? adapter.getCoreDB() : null;
  }

  async importNodes(params: ImportNodesParams<T>): Promise<ImportResult> {
    const result = await super.importNodes(params);
    if (result?.success) {
      this.notifyLifecycle(params, result);
    }
    return result;
  }

  private notifyLifecycle(params: ImportNodesParams<T>, result: ImportResult): void {
    if (!this.coreDB) return;
    try {
      const lifecycle = EntityLifecycleManager.getSingleton(this.coreDB);
      const now = Date.now() as Timestamp;
      const payload: ImportNodesPayload = {
        nodes: {},
        nodeIds: result.importedNodeIds,
        toParentId: params.targetParentId,
        onNameConflict: params.conflictResolution === 'rename' ? 'auto-rename' : undefined,
      };
      const envelope: CommandEnvelope<'importNodes', ImportNodesPayload> = {
        commandId: `import-${now}`,
        groupId: `import-${now}`,
        kind: 'importNodes',
        payload,
        issuedAt: now,
      };
      void lifecycle.handleCommand(envelope);
    } catch {
      // best-effort: lifecycle hooks must never break import completion
    }
  }
}
