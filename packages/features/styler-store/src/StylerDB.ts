import { getDBName, SingletonMixin } from '@hierarchidb/util';
import { Dexie, type Table } from 'dexie';
import type { StyleRecord } from '@hierarchidb/plugin-service-api';

export class StylerDB extends Dexie {
  styles!: Table<StyleRecord, string>;

  static async getSingleton(name?: string): Promise<StylerDB> {
    return SingletonMixin.getSingleton('StylerDB', async () => {
      const db = new StylerDB(name);
      await db.open();
      return db;
    });
  }

  constructor(name: string = getDBName('style')) {
    super(name);
    this.version(1).stores({
      styles: '&nodeId, targetProperty, updatedAt',
    });
    this.styles = this.table('styles');
  }
}
