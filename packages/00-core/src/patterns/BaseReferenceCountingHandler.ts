import type { NodeId } from '../types';

/**
 * Base pattern for entities that require reference counting
 * 
 * This abstract class provides a template for managing entities with reference counting,
 * commonly used in plugins that share data between multiple nodes (e.g., spreadsheet, stylemap).
 * 
 * The pattern involves:
 * - PeerEntity: The entity directly associated with a node
 * - RelationalEntity: The shared data entity referenced by multiple PeerEntities
 * 
 * When the last PeerEntity referencing a RelationalEntity is deleted,
 * the RelationalEntity is also deleted (reference counting).
 * 
 * Note: This is a pattern/interface definition in the core package.
 * Implementations should be in the respective plugin's handler directory.
 */
export abstract class BaseReferenceCountingHandler {
  /**
   * Get the field name that references the node in the PeerEntity
   * @returns Field name (e.g., 'nodeId')
   */
  protected abstract getNodeRefField(): string;
  
  /**
   * Get the field name that references the RelationalEntity in the PeerEntity
   * @returns Field name (e.g., 'metadataId', 'styleId')
   */
  protected abstract getRelRefField(): string;
  
  /**
   * Get the PeerEntity associated with a node
   * @param nodeId - The node ID
   * @returns The PeerEntity or null if not found
   */
  protected abstract getPeerEntity(nodeId: NodeId): Promise<any>;
  
  /**
   * Delete the PeerEntity associated with a node
   * @param nodeId - The node ID
   */
  protected abstract deletePeerEntity(nodeId: NodeId): Promise<void>;
  
  /**
   * Delete the RelationalEntity and all related data
   * @param relRef - The reference to the RelationalEntity
   */
  protected abstract deleteRelationalEntity(relRef: any): Promise<void>;
  
  /**
   * Count how many PeerEntities reference a RelationalEntity
   * @param relRef - The reference to the RelationalEntity
   * @returns The number of references
   */
  protected abstract countPeerEntitiesByRelRef(relRef: any): Promise<number>;

  /**
   * Increment the reference count for an entity
   * Default implementation assumes reference count increases naturally when PeerEntity is created
   * @param nodeId - The node ID
   */
  async incrementReferenceCount(_nodeId: NodeId): Promise<void> {
    // PeerEntityが作成されることで、自然に参照カウントが増加
  }

  /**
   * Decrement the reference count and delete RelationalEntity if no more references
   * @param nodeId - The node ID
   */
  async decrementReferenceCount(nodeId: NodeId): Promise<void> {
    const peerEntity = await this.getPeerEntity(nodeId);
    if (!peerEntity) return;

    const relRefField = this.getRelRefField();
    const relRef = peerEntity[relRefField];

    await this.deletePeerEntity(nodeId);
    const remainingCount = await this.countPeerEntitiesByRelRef(relRef);

    if (remainingCount === 0) {
      await this.deleteRelationalEntity(relRef);
    }
  }

  /**
   * Get the current reference count for an entity
   * @param nodeId - The node ID
   * @returns The reference count
   */
  async getReferenceCount(nodeId: NodeId): Promise<number> {
    const peerEntity = await this.getPeerEntity(nodeId);
    if (!peerEntity) return 0;

    const relRefField = this.getRelRefField();
    const relRef = peerEntity[relRefField];
    
    return await this.countPeerEntitiesByRelRef(relRef);
  }
}