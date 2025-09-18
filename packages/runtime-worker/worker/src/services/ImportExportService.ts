import type { ImportNodesParams, ImportResult } from '@hierarchidb/common-api';
import { EntityLifecycleManager } from '../entity/EntityLifecycleManager.js';
import { ImportExportService as BaseImportExportService } from '@hierarchidb/import-export';
import type { ImportExportDBPort } from '@hierarchidb/import-export';
import { SingletonMixin } from '@hierarchidb/util';

// Augment base ImportExportService with lifecycle notifications.
export class ImportExportService extends BaseImportExportService {
  static async getSingleton(db: ImportExportDBPort): Promise<ImportExportService> {
    return SingletonMixin.getSingleton(ImportExportService.name, () => new ImportExportService(db));
  }

  private constructor(db: ImportExportDBPort) {
    super(db);
  }

  async importNodes(params: ImportNodesParams): Promise<ImportResult> {
    const result = await super.importNodes(params);
    if (result?.success) {
      try {
        const lifecycle = EntityLifecycleManager.getSingleton((this as any).db);
        await lifecycle.handleCommand({
          commandId: `imp-${Date.now()}`,
          groupId: `g-${Date.now()}`,
          kind: 'importNodes',
          payload: { ...params, nodeIds: [] },
          issuedAt: Date.now(),
        } as any);
      } catch {
        // best-effort
      }
    }
    return result;
  }
}
