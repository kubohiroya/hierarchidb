import Dexie, { Table } from 'dexie';
import type { WorkingCopy, TreeViewState, TreeNodeId } from '@hierarchidb/core';

export type WorkingCopyRow = WorkingCopy;
export type TreeViewStateRow = TreeViewState;

export class EphemeralDB extends Dexie {
  workingCopies!: Table<WorkingCopyRow, string>;
  views!: Table<TreeViewStateRow, string>;

  constructor(name: string = 'hierarchidb') {
    super(`${name}-EphemeralDB`);

    this.version(1).stores({
      workingCopies: '&workingCopyId, workingCopyOf, parentTreeNodeId, updatedAt',
      views: '&treeViewId, updatedAt, [treeId+treeRootNodeType], [treeId+pageNodeId]',
    });
  }

  async initialize(): Promise<void> {
    if ((await this.workingCopies.count()) !== 0) {
      console.log('initialize workingCopies');
      this.workingCopies.clear();
    }
    if ((await this.views.count()) === 0) {
      console.log('initialize views');
      this.views.clear();
    }
  }

  // WorkingCopy CRUD operations
  async getWorkingCopy(workingCopyId: string): Promise<WorkingCopy | undefined> {
    return await this.workingCopies.get(workingCopyId);
  }

  async updateWorkingCopy(workingCopy: WorkingCopy): Promise<void> {
    await this.workingCopies.put(workingCopy);
  }

  async deleteWorkingCopy(workingCopyId: string): Promise<void> {
    await this.workingCopies.delete(workingCopyId);
  }
}
