/**
 * @file NodeTypeAPI.test.ts
 * @description Comprehensive test suite for NodeTypeAPI implementation
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import type { NodeId, NodeTypeDefinition, EntityHandler, PeerEntity, GroupEntity, WorkingCopyProperties, EntityId, TreeNode } from '@hierarchidb/common-core';
import { WorkerAPIImpl } from '../../WorkerAPIImpl';
import { CoreDB } from '../../db/CoreDB';
import type { NodeTypeAPI } from '@hierarchidb/common-api';

// Mock entity handler
class MockEntityHandler implements EntityHandler<PeerEntity, GroupEntity, PeerEntity & WorkingCopyProperties> {
  async createEntity(nodeId: NodeId, data?: Partial<PeerEntity>): Promise<PeerEntity> {
    const now = Date.now();
    return {
      id: nodeId as unknown as EntityId,
      nodeId,
      createdAt: now,
      updatedAt: now,
      version: 1,
      ...data
    };
  }
  
  async getEntity(nodeId: NodeId): Promise<PeerEntity> {
    const now = Date.now();
    return {
      id: nodeId as unknown as EntityId,
      nodeId,
      createdAt: now,
      updatedAt: now,
      version: 1,
      data: 'mock'
    } as PeerEntity;
  }
  
  async updateEntity(nodeId: NodeId, data: Partial<PeerEntity>): Promise<void> {
    return Promise.resolve();
  }
  
  async deleteEntity(nodeId: NodeId): Promise<void> {
    return Promise.resolve();
  }
  
  async createWorkingCopy(nodeId: NodeId, isDraft?: boolean): Promise<PeerEntity & WorkingCopyProperties> {
    const entity = await this.getEntity(nodeId);
    return {
      ...entity,
      nodeId,
      originalNodeId: isDraft ? undefined : nodeId,
      copiedAt: Date.now()
    };
  }

  async getWorkingCopy(nodeId: NodeId): Promise<PeerEntity & WorkingCopyProperties> {
    const entity = await this.getEntity(nodeId);
    return {
      ...entity,
      nodeId,
      originalNodeId: nodeId,
      copiedAt: Date.now()
    };
  }

  async commitWorkingCopy(nodeId: NodeId, workingCopy: PeerEntity & WorkingCopyProperties): Promise<void> {
    return Promise.resolve();
  }

  async discardWorkingCopy(nodeId: NodeId): Promise<void> {
    return Promise.resolve();
  }
}

describe('NodeTypeAPI', () => {
  let api: NodeTypeAPI;
  let workerAPI: WorkerAPIImpl;
  let coreDB: CoreDB;

  // Test node type definitions
  const testNodeTypes: NodeTypeDefinition[] = [
    {
      nodeType: 'folder',
      name: 'folder',
      displayName: 'Folder',
      icon: '📁',
      database: {
        entityStore: 'folders',
        schema: { '&id, nodeId': '' },
        version: 1
      },
      validation: {
        allowedChildTypes: ['folder', 'document', 'image'],
        maxChildren: 100,
        customValidators: [
          {
            name: 'nameRequired',
            validate: (node: any) => {
              if (!node.name || node.name.trim() === '') {
                return { valid: false, message: 'Name is required' };
              }
              return { valid: true };
            }
          }
        ]
      },
      entityHandler: new MockEntityHandler(),
      lifecycle: {
        beforeCreate: async (parentId: NodeId, nodeData: Partial<TreeNode>) => {
          console.log('Creating folder in parent:', parentId);
        },
        afterCreate: async (nodeId: NodeId, entity: PeerEntity) => {
          console.log('Created folder:', nodeId);
        },
      }
    },
    {
      nodeType: 'document',
      name: 'document',
      displayName: 'Document',
      icon: '📄',
      database: {
        entityStore: 'documents',
        schema: { '&id, nodeId': '' },
        version: 1
      },
      validation: {
        allowedChildTypes: [],
        maxChildren: 0,
        customValidators: [
          {
            name: 'maxLength',
            validate: (node: any) => {
              if (node.description && node.description.length > 1000) {
                return { valid: false, message: 'Description too long' };
              }
              return { valid: true };
            }
          }
        ]
      },
      entityHandler: new MockEntityHandler(),
      lifecycle: {}
    },
    {
      nodeType: 'image',
      name: 'image',
      displayName: 'Image',
      icon: '🖼️',
      database: {
        entityStore: 'images',
        schema: { '&id, nodeId': '' },
        version: 1
      },
      entityHandler: new MockEntityHandler(),
      lifecycle: {}
    },
  ];

  beforeEach(async () => {
    // Initialize database
    coreDB = await CoreDB.getSingleton();
    await coreDB.open();
    
    // Initialize WorkerAPI
    workerAPI = new WorkerAPIImpl();
    api = workerAPI.getNodeTypeAPI();
    
    // Register test node types
    for (const nodeType of testNodeTypes) {
      await api.registerNodeType(nodeType);
    }
  });

  afterEach(async () => {
    // Clear all registered node types
    const allTypes = await api.listNodeTypes();
    for (const type of allTypes) {
      await api.unregisterNodeType(type);
    }
    
    await coreDB.close();
    vi.clearAllMocks();
  });

  describe('registerNodeType', () => {
    it('should register a new node type', async () => {
      const newType: NodeTypeDefinition = {
        nodeType: 'video',
        name: 'video',
        displayName: 'Video',
        icon: '🎥',
        database: {
          entityStore: 'videos',
          schema: { '&id, nodeId': '' },
          version: 1
        },
        entityHandler: new MockEntityHandler(),
        lifecycle: {}
      };
      
      await api.registerNodeType(newType);
      
      const definition = await api.getNodeTypeDefinition('video');
      expect(definition).toBeDefined();
      expect(definition?.displayName).toBe('Video');
      expect(definition?.icon).toBe('🎥');
    });

    it('should reject duplicate node type registration', async () => {
      await expect(
        api.registerNodeType(testNodeTypes[0])
      ).rejects.toThrow();
    });

    it('should validate node type definition', async () => {
      const invalidType: any = {
        // Missing required nodeType field
        displayName: 'Invalid',
        entityHandler: new MockEntityHandler(),
      };
      
      await expect(
        api.registerNodeType(invalidType)
      ).rejects.toThrow();
    });
  });

  describe('unregisterNodeType', () => {
    it('should remove a registered node type', async () => {
      await api.unregisterNodeType('image');
      
      const definition = await api.getNodeTypeDefinition('image');
      expect(definition).toBeNull();
      
      const types = await api.listNodeTypes();
      expect(types).not.toContain('image');
    });

    it('should handle unregistering non-existent type', async () => {
      await expect(
        api.unregisterNodeType('non-existent')
      ).rejects.toThrow();
    });
  });

  describe('getNodeTypeDefinition', () => {
    it('should retrieve node type definition', async () => {
      const definition = await api.getNodeTypeDefinition('folder');
      
      expect(definition).toBeDefined();
      expect(definition?.nodeType).toBe('folder');
      expect(definition?.displayName).toBe('Folder');
      expect(definition?.icon).toBe('📁');
      expect(definition?.validation?.allowedChildTypes).toEqual(['folder', 'document', 'image']);
      expect(definition?.validation?.maxChildren).toBe(100);
    });

    it('should return null for non-existent type', async () => {
      const definition = await api.getNodeTypeDefinition('non-existent');
      expect(definition).toBeNull();
    });
  });

  describe('listNodeTypes', () => {
    it('should return all registered node types', async () => {
      const types = await api.listNodeTypes();
      
      expect(types).toHaveLength(3);
      expect(types).toContain('folder');
      expect(types).toContain('document');
      expect(types).toContain('image');
    });

    it('should return empty array when no types registered', async () => {
      // Unregister all types
      for (const type of ['folder', 'document', 'image']) {
        await api.unregisterNodeType(type);
      }
      
      const types = await api.listNodeTypes();
      expect(types).toEqual([]);
    });
  });

  describe('getNodeTypesByCategory', () => {
    it('should filter node types by category', async () => {
      const containerTypes = await api.getNodeTypesByCategory('container');
      expect(containerTypes).toEqual(['folder']);
      
      const contentTypes = await api.getNodeTypesByCategory('content');
      expect(contentTypes).toEqual(['document']);
      
      const mediaTypes = await api.getNodeTypesByCategory('media');
      expect(mediaTypes).toEqual(['image']);
    });

    it('should return empty array for non-existent category', async () => {
      const types = await api.getNodeTypesByCategory('non-existent');
      expect(types).toEqual([]);
    });
  });

  describe('isNodeTypeRegistered', () => {
    it('should check if node type is registered', async () => {
      const isFolderRegistered = await api.isNodeTypeRegistered('folder');
      expect(isFolderRegistered).toBe(true);
      
      const isVideoRegistered = await api.isNodeTypeRegistered('video');
      expect(isVideoRegistered).toBe(false);
    });
  });

  describe('getAllowedChildTypes', () => {
    it('should return allowed child types for a node type', async () => {
      const folderChildren = await api.getAllowedChildTypes('folder');
      expect(folderChildren).toEqual(['folder', 'document', 'image']);
      
      const documentChildren = await api.getAllowedChildTypes('document');
      expect(documentChildren).toEqual([]);
    });

    it('should return null for non-existent type', async () => {
      const children = await api.getAllowedChildTypes('non-existent');
      expect(children).toBeNull();
    });
  });

  describe('canContainChild', () => {
    it('should check if parent can contain child type', async () => {
      const canFolderContainDoc = await api.canContainChild('folder', 'document');
      expect(canFolderContainDoc).toBe(true);
      
      const canFolderContainVideo = await api.canContainChild('folder', 'video');
      expect(canFolderContainVideo).toBe(false);
      
      const canDocContainAnything = await api.canContainChild('document', 'folder');
      expect(canDocContainAnything).toBe(false);
    });

    it('should return false for non-existent types', async () => {
      const result = await api.canContainChild('non-existent', 'folder');
      expect(result).toBe(false);
    });
  });

  describe('getNodeTypeMetadata', () => {
    it('should retrieve node type metadata', async () => {
      const folderMetadata = await api.getNodeTypeMetadata('folder');
      expect(folderMetadata).toBeNull(); // No metadata defined in test node types
      
      const imageMetadata = await api.getNodeTypeMetadata('image');
      expect(imageMetadata).toBeNull(); // No metadata defined in test node types
    });

    it('should return null for non-existent type', async () => {
      const metadata = await api.getNodeTypeMetadata('non-existent');
      expect(metadata).toBeNull();
    });
  });

  describe('updateNodeTypeMetadata', () => {
    it('should update node type metadata', async () => {
      await api.updateNodeTypeMetadata('folder', {
        id: 'folder-meta',
        name: 'Folder Plugin',
        version: '1.0.0',
        nodeType: 'folder',
        status: 'active',
      });
      
      const metadata = await api.getNodeTypeMetadata('folder');
      expect(metadata).toEqual({
        id: 'folder-meta',
        name: 'Folder Plugin',
        version: '1.0.0',
        nodeType: 'folder',
        status: 'active',
      });
    });

    it('should handle non-existent type', async () => {
      await expect(
        api.updateNodeTypeMetadata('non-existent', {
          id: 'test',
          name: 'Test',
          version: '1.0.0',
          nodeType: 'non-existent',
          status: 'active'
        })
      ).rejects.toThrow();
    });
  });

  describe('validateNodeType', () => {
    it('should validate node against its type validators', async () => {
      const validNode = {
        id: 'test' as NodeId,
        parentId: 'parent' as NodeId,
        nodeType: 'folder',
        name: 'Valid Folder',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };
      
      const validResult = await api.validateNodeType(validNode);
      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toEqual([]);
      
      const invalidNode = {
        ...validNode,
        name: '', // Empty name should fail validation
      };
      
      const invalidResult = await api.validateNodeType(invalidNode);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors).toHaveLength(1);
      expect(invalidResult.errors[0]).toContain('Name is required');
    });

    it('should validate document length constraint', async () => {
      const longDocument = {
        id: 'test' as NodeId,
        parentId: 'parent' as NodeId,
        nodeType: 'document',
        name: 'Document',
        description: 'a'.repeat(1001), // Exceeds max length
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };
      
      const result = await api.validateNodeType(longDocument);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Description too long');
    });

    it('should pass validation for types without validators', async () => {
      const imageNode = {
        id: 'test' as NodeId,
        parentId: 'parent' as NodeId,
        nodeType: 'image',
        name: 'Image',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };
      
      const result = await api.validateNodeType(imageNode);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('getNodeTypeHooks', () => {
    it('should retrieve node type hooks', async () => {
      const hooks = await api.getNodeTypeHooks('folder');
      
      expect(hooks).toBeDefined();
      expect(hooks?.beforeCreate).toBeDefined();
      expect(hooks?.afterCreate).toBeDefined();
      expect(typeof hooks?.beforeCreate).toBe('function');
      expect(typeof hooks?.afterCreate).toBe('function');
    });

    it('should return null for type without hooks', async () => {
      const hooks = await api.getNodeTypeHooks('document');
      expect(hooks).toBeNull();
    });

    it('should return null for non-existent type', async () => {
      const hooks = await api.getNodeTypeHooks('non-existent');
      expect(hooks).toBeNull();
    });
  });

  describe('getNodeTypeStats', () => {
    it('should return statistics for all node types', async () => {
      // Add some nodes to database for statistics
      await coreDB.nodes.bulkAdd([
        {
          id: 'f1' as NodeId,
          parentId: 'root' as NodeId,
          nodeType: 'folder',
          name: 'Folder 1',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        },
        {
          id: 'f2' as NodeId,
          parentId: 'root' as NodeId,
          nodeType: 'folder',
          name: 'Folder 2',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        },
        {
          id: 'd1' as NodeId,
          parentId: 'f1' as NodeId,
          nodeType: 'document',
          name: 'Doc 1',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        },
      ]);
      
      const stats = await api.getNodeTypeStats();
      
      expect(stats).toBeDefined();
      expect(stats['folder']).toBe(2);
      expect(stats['document']).toBe(1);
      expect(stats['image']).toBe(0);
    });
  });
});