import { SingletonMixin } from '@hierarchidb/util';
import type { NodeId, TreeViewState, TreeNode } from '@hierarchidb/common-type';
import Dexie, { type Table } from 'dexie';

export type WorkingCopyRow = TreeNode;
export type TreeViewStateRow = TreeViewState;

export class EphemeralDB extends Dexie {
  workingCopies!: Table<WorkingCopyRow, NodeId>;
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
      workingCopies: '&id, workingCopyOf, parentId, updatedAt',
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
  async getWorkingCopy(workingCopyId: NodeId): Promise<TreeNode | undefined> {
    return (await this.workingCopies.get(workingCopyId)) as unknown as TreeNode | undefined;
  }

  async updateWorkingCopy(workingCopy: TreeNode): Promise<void> {
    await this.workingCopies.put(workingCopy);
  }

  async discardWorkingCopy(workingCopyId: NodeId): Promise<void> {
    await this.workingCopies.delete(workingCopyId);
  }

  async createWorkingCopy(workingCopy: TreeNode): Promise<void> {
    await this.workingCopies.add(workingCopy);
  }

  async deleteWorkingCopy(workingCopyId: NodeId): Promise<void> {
    await this.workingCopies.delete(workingCopyId);
  }

  async listWorkingCopies(): Promise<TreeNode[]> {
    return (await this.workingCopies.toArray()) as unknown as TreeNode[];
  }
}
