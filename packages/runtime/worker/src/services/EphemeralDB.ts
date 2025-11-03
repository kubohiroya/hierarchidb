import type { TreeViewState } from '@hierarchidb/common-types';
import { getDBName, SingletonMixin } from '@hierarchidb/util';
import { Dexie, type Table } from 'dexie';

export type TreeViewStateRow = TreeViewState;

export class EphemeralDB extends Dexie {
  views!: Table<TreeViewStateRow, string>;

  static async getSingleton(_name?: string): Promise<EphemeralDB> {
    return SingletonMixin.getSingleton(EphemeralDB.name, async () => {
      const instance = new EphemeralDB(getDBName('ephemeral-db'));
      await instance.initialize();
      return instance;
    });
  }

  private constructor(name: string) {
    super(name);

    this.version(1).stores({
      views: '&treeViewId, updatedAt, [treeId+treeRootNodeType], [treeId+pageNodeId]',
    });
  }

  async initialize(): Promise<void> {
    // Views should be kept between sessions, no need to clear
  }

  // Note: Working copies are managed in CoreDB via holder nodes; EphemeralDB retains only view state.
}
