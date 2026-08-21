import { SingletonMixin } from '@hierarchidb/util';
import { Dexie, type Table } from 'dexie';
import type { StyleRecord } from '@hierarchidb/style-api';

export class StylerDB extends Dexie {
  styles!: Table<StyleRecord, string>;

  static async getSingleton(databaseName: string): Promise<StylerDB> {
    const instance = await SingletonMixin.getSingleton('StylerDB', async () => {
      const db = new StylerDB(databaseName);
      await db.open();
      return db;
    });
    if (instance.name !== databaseName) {
      throw new Error('styler-database-name-mismatch');
    }
    return instance;
  }

  constructor(databaseName: string) {
    super(databaseName);
    this.version(1).stores({
      styles: '&nodeId, targetProperty, updatedAt',
    });
    this.styles = this.table('styles');
  }
}
