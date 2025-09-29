import type { ImportNodesParams, ImportResult } from '@hierarchidb/common-api';
import { EntityLifecycleManager } from '../entity/EntityLifecycleManager.js';
import { ImportExportService as BaseImportExportService } from '@hierarchidb/import-export';
import type { ImportExportDBPort } from '@hierarchidb/import-export';
import type { CoreDB } from './CoreDB.js';
import type { CommandEnvelope, ImportNodesPayload } from '@hierarchidb/common-type';
import type { Timestamp } from '@hierarchidb/common-type';
import { SingletonMixin } from '@hierarchidb/util';

// Augment base ImportExportService with lifecycle notifications.
export class ImportExportService extends BaseImportExportService {
  private readonly coreDB: CoreDB | null;

  static async getSingleton(db: ImportExportDBPort): Promise<ImportExportService> {
    return SingletonMixin.getSingleton(ImportExportService.name, () => new ImportExportService(db));
  }

  private constructor(db: ImportExportDBPort) {
    super(db);
    const adapter = db as { getCoreDB?: () => CoreDB };
    this.coreDB = typeof adapter.getCoreDB === 'function'
      ? adapter.getCoreDB()
      : null;
  }

  async importNodes(params: ImportNodesParams): Promise<ImportResult> {
    const result = await super.importNodes(params);
    if (result?.success) {
      this.notifyLifecycle(params, result);
    }
    return result;
  }

  private notifyLifecycle(params: ImportNodesParams, result: ImportResult): void {
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
