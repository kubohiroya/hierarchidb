import type { NodeId } from '@hierarchidb/common-types';
import type {
  StyleDescriptor,
  StyleKeyValues,
  StyleMutationAPI,
  StyleQueryAPI,
  StyleRecord,
} from '@hierarchidb/style-api';
import type { StylerDB } from '@hierarchidb/styler-store';
import { SingletonMixin } from '@hierarchidb/util';

export class StyleService implements StyleQueryAPI, StyleMutationAPI {
  static async getSingleton(db: StylerDB): Promise<StyleService> {
    return SingletonMixin.getSingleton('StyleService', async () => new StyleService(db));
  }

  constructor(private db: StylerDB) {}

  async getStyleDescriptor(nodeId: NodeId): Promise<StyleDescriptor | null> {
    const record = await this.db.styles.get(nodeId);
    if (!record) return null;
    const { keyValues, ...descriptor } = record;
    return descriptor;
  }

  async getStyleKeyValues(nodeId: NodeId): Promise<StyleKeyValues | null> {
    const record = await this.db.styles.get(nodeId);
    if (!record) return null;
    return {
      nodeId: record.nodeId,
      keyColumn: record.keyColumn,
      valueType: record.valueType,
      entries: record.keyValues ?? [],
    };
  }

  async upsertStyle(record: StyleRecord): Promise<void> {
    const updatedAt = record.updatedAt || Date.now();
    await this.db.styles.put({ ...record, updatedAt });
  }

  async deleteStyle(nodeId: NodeId): Promise<void> {
    await this.db.styles.delete(nodeId);
  }
}
