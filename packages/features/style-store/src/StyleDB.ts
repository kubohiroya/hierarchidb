import { getDBName, SingletonMixin } from '@hierarchidb/util';
import { Dexie, type Table } from 'dexie';
import type { StyleRecord } from '@hierarchidb/plugin-service-api';

export class StyleDB extends Dexie {
  styles!: Table<StyleRecord, string>;

  static async getSingleton(name?: string): Promise<StyleDB> {
    return SingletonMixin.getSingleton(StyleDB.name, async () => {
      const db = new StyleDB(name);
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
