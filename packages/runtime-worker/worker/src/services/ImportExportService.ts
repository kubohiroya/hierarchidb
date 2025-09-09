import type { ImportNodesParams, ImportResult } from '@hierarchidb/common-api';
import { FEATURE_FLAGS } from '../config/feature-flags';
import { EntityLifecycleManager } from '../entity/EntityLifecycleManager';
import { ImportExportService as BaseImportExportService } from '@hierarchidb/import-export';

// Wrapper that augments base ImportExportService with lifecycle notifications
// when WORKER_ENTITY_UNIFIED is enabled. Keeps API compatible.
export class ImportExportService extends BaseImportExportService {
  static async getSingleton(db: any): Promise<Pick<BaseImportExportService, keyof BaseImportExportService>> {
    const base = await BaseImportExportService.getSingleton(db);
    // Return a proxy that intercepts importNodes to emit lifecycle events
    const wrapper: any = Object.create(base);
    wrapper.importNodes = async (params: ImportNodesParams): Promise<ImportResult> => {
      const result = await (base as any).importNodes(params);
      if (result?.success && FEATURE_FLAGS.WORKER_ENTITY_UNIFIED) {
        try {
          const lifecycle = EntityLifecycleManager.getSingleton(db as any);
          // Minimal envelope for lifecycle consumption
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
    };
    return wrapper as any;
  }
}
