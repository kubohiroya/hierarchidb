// Basic working entity handler for default plugins
import type {
  EntityHandler,
  NodeId,
  PeerEntity,
  WorkingCopyProperties,
} from '@hierarchidb/common-type';

export class EntityHandlerImpl implements EntityHandler {
  async createEntity(nodeId: NodeId, data?: Partial<PeerEntity>): Promise<PeerEntity> {
    // Create a basic entity with minimal required fields
    const entity: PeerEntity = {
      id: crypto.randomUUID() as any, // Generate a unique ID
      nodeId,
      createdAt: Date.now() as any,
      updatedAt: Date.now() as any,
      version: 1,
      ...data, // Spread additional data
    };

    // In a real implementation, this would save to database
    console.log(`Created entity for node ${nodeId}:`, entity);
    return entity;
  }

  async getEntity(nodeId: NodeId): Promise<PeerEntity | undefined> {
    // In a real implementation, this would query the database
    console.log(`Getting entity for node ${nodeId}`);
    return undefined; // Return undefined for now as we don't have persistent storage
  }

  async updateEntity(nodeId: NodeId, data: Partial<PeerEntity>): Promise<void> {
    // In a real implementation, this would update the database
    console.log(`Updated entity for node ${nodeId}:`, data);
  }

  async deleteEntity(nodeId: NodeId): Promise<void> {
    // In a real implementation, this would delete from database
    console.log(`Deleted entity for node ${nodeId}`);
  }

  async createWorkingCopy(nodeId: NodeId): Promise<PeerEntity & WorkingCopyProperties> {
    // Create working copy based on existing entity
    const entity = await this.getEntity(nodeId);
    const workingCopy: PeerEntity & WorkingCopyProperties = {
      ...(entity || {
        id: crypto.randomUUID() as any,
        nodeId,
        createdAt: Date.now() as any,
        updatedAt: Date.now() as any,
        version: 1,
      }),
      originalNodeId: nodeId,
      copiedAt: Date.now(),
      hasEntityCopy: true,
    };

    console.log(`Created working copy for node ${nodeId}:`, workingCopy);
    return workingCopy;
  }

  async commitWorkingCopy(
    nodeId: NodeId,
    workingCopy: PeerEntity & WorkingCopyProperties
  ): Promise<void> {
    // In a real implementation, this would commit the working copy to the main entity
    console.log(`Committed working copy for node ${nodeId}:`, workingCopy);
  }

  async discardWorkingCopy(nodeId: NodeId): Promise<void> {
    // In a real implementation, this would discard the working copy
    console.log(`Discarded working copy for node ${nodeId}`);
  }
}
