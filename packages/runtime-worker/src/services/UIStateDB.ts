import { getDBName, SingletonMixin } from '@hierarchidb/util';
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

  static async getSingleton(name?: string): Promise<UIStateDB> {
    return SingletonMixin.getSingleton('UIStateDB', async () => {
      const db = new UIStateDB(name);
      await db.open();
      return db;
    });
  }

  constructor(name: string = getDBName('ui-state')) {
    super(name);
    this.version(4).stores({
      treetableProps: '&pageNodeId',
      treetableExpanded: '&[pageNodeId+nodeId], pageNodeId, nodeId',
    });
    this.treetableProps = this.table('treetableProps');
    this.treetableExpanded = this.table('treetableExpanded');
  }
}
