import { SingletonMixin } from '@hierarchidb/util';
import { Dexie, type Table } from 'dexie';

export type TreeTablePropsRow = {
  pageNodeId: string;
  updatedAt: number;
} & Record<string, unknown>;

export type TreeTableExpandedRow = {
  pageNodeId: string;
  nodeId: string;
  updatedAt: number;
};

export class UIStateDB extends Dexie {
  treetableProps!: Table<TreeTablePropsRow, string>;
  treetableExpanded!: Table<TreeTableExpandedRow, [string, string]>;

  static async getSingleton(databaseName: string): Promise<UIStateDB> {
    const instance = await SingletonMixin.getSingleton('UIStateDB', async () => {
      const db = new UIStateDB(databaseName);
      await db.open();
      return db;
    });
    if (instance.name !== databaseName) {
      throw new Error('ui-state-database-name-mismatch');
    }
    return instance;
  }

  constructor(databaseName: string) {
    super(databaseName);
    this.version(1).stores({
      treetableProps: '&pageNodeId',
      treetableExpanded: '&[pageNodeId+nodeId], pageNodeId, nodeId',
    });
    this.treetableProps = this.table('treetableProps');
    this.treetableExpanded = this.table('treetableExpanded');
  }
}
