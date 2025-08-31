import { SingletonMixin } from '@hierarchidb/util';
import type { TreeViewState, WorkingCopy } from '@hierarchidb/common-type';
import Dexie, { type Table } from 'dexie';

export type WorkingCopyRow = WorkingCopy;
export type TreeViewStateRow = TreeViewState;

export class EphemeralDB extends Dexie {
  workingCopies!: Table<WorkingCopyRow, string>;
  views!: Table<TreeViewStateRow, string>;

  static async getSingleton(name: string = 'hierarchidb'): Promise<EphemeralDB> {
    return SingletonMixin.getSingleton(EphemeralDB.name, async () => {
      const instance = new EphemeralDB(name);
      await instance.initialize();
      return instance;
    });
  }

  private constructor(name: string = 'hierarchidb') {
    super(`${name}-EphemeralDB`);

    this.version(1).stores({
      workingCopies: '&workingCopyId, workingCopyOf, parentId, updatedAt',
      views: '&treeViewId, updatedAt, [treeId+treeRootNodeType], [treeId+pageNodeId]',
    });
  }

  async initialize(): Promise<void> {
    // Clear working copies on initialization
    if ((await this.workingCopies.count()) !== 0) {
      await this.workingCopies.clear();
    }
    // Views should be kept between sessions, no need to clear
  }

  // WorkingCopyTypes CRUD operations
  async getWorkingCopy(workingCopyId: string): Promise<WorkingCopy | undefined> {
    return await this.workingCopies.get(workingCopyId);
  }

  async updateWorkingCopy(workingCopy: WorkingCopy): Promise<void> {
    await this.workingCopies.put(workingCopy);
  }

  async discardWorkingCopy(workingCopyId: string): Promise<void> {
    await this.workingCopies.delete(workingCopyId);
  }

  async createWorkingCopy(workingCopy: WorkingCopy): Promise<void> {
    await this.workingCopies.add(workingCopy);
  }

  async deleteWorkingCopy(workingCopyId: string): Promise<void> {
    await this.workingCopies.delete(workingCopyId);
  }

  async listWorkingCopies(): Promise<WorkingCopy[]> {
    return await this.workingCopies.toArray();
  }
}
