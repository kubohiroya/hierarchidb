/**
 * @file TreeQueryAPI.test.ts
 * @description Comprehensive test suite for TreeQueryAPI implementation
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import type { NodeId, TreeId, TreeNode, Tree } from '@hierarchidb/common-core';
import { WorkerAPIImpl } from '../../WorkerAPIImpl';
import { TreeQueryService } from '../../services/TreeQueryService';
import { CoreDB } from '../../db/CoreDB';

describe('TreeQueryAPI', () => {
  let workerAPI: WorkerAPIImpl;
  let queryService: TreeQueryService;
  let coreDB: CoreDB;

  // Test data
  const testTreeId = 'test-tree' as TreeId;
  const rootNodeId = 'root' as NodeId;
  
  const testNodes: TreeNode[] = [
    {
      id: rootNodeId,
      parentId: null as any,
      nodeType: 'folder',
      name: 'Root',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    },
    {
      id: 'node1' as NodeId,
      parentId: rootNodeId,
      nodeType: 'folder',
      name: 'Folder 1',
      description: 'Test folder-plugin 1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    },
    {
      id: 'node2' as NodeId,
      parentId: rootNodeId,
      nodeType: 'document',
      name: 'Document 1',
      description: 'Test document',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    },
    {
      id: 'node1-1' as NodeId,
      parentId: 'node1' as NodeId,
      nodeType: 'document',
      name: 'Nested Document',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    },
  ];

  beforeEach(async () => {
    // Initialize WorkerAPI (this will also initialize CoreDB)
    workerAPI = await WorkerAPIImpl.getSingleton();
    
    // Get the services directly for testing
    queryService = (workerAPI as any).queryService;
    coreDB = (workerAPI as any).coreDB;
    
    // Clear existing data
    await coreDB.nodes.clear();
    await coreDB.trees.clear();
    
    // Add test data
    await coreDB.trees.add({
      treeId: testTreeId,
      treeRootNodeId: rootNodeId,
      treeTrashRootNodeId: 'trash' as NodeId,
      superRootNodeId: rootNodeId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    
    await coreDB.nodes.bulkAdd(testNodes);
    
    // Initialize WorkerAPI
    workerAPI = new WorkerAPIImpl(coreDB);
    queryService = workerAPI.getQueryAPI();
  });

  afterEach(async () => {
    await coreDB.close();
    vi.clearAllMocks();
  });

  describe('getTree', () => {
    it('should retrieve tree metadata by ID', async () => {
      const tree = await queryService.getTree(testTreeId);
      
      expect(tree).toBeDefined();
      expect(tree?.treeId).toBe(testTreeId);
      expect(tree?.treeRootNodeId).toBe(rootNodeId);
    });

    it('should return null for non-existent tree', async () => {
      const tree = await queryService.getTree('non-existent' as TreeId);
      expect(tree).toBeNull();
    });
  });

  describe('getNode', () => {
    it('should retrieve a node by ID', async () => {
      const node = await queryService.getNode('node1' as NodeId);
      
      expect(node).toBeDefined();
      expect(node?.id).toBe('node1');
      expect(node?.name).toBe('Folder 1');
      expect(node?.nodeType).toBe('folder');
    });

    it('should return null for non-existent node', async () => {
      const node = await queryService.getNode('non-existent' as NodeId);
      expect(node).toBeNull();
    });
  });

  describe('getNodes', () => {
    it('should retrieve multiple nodes by IDs', async () => {
      const nodes = await queryService.getNodes(['node1' as NodeId, 'node2' as NodeId]);
      
      expect(nodes).toHaveLength(2);
      expect(nodes[0]?.id).toBe('node1');
      expect(nodes[1]?.id).toBe('node2');
    });

    it('should return only existing nodes', async () => {
      const nodes = await queryService.getNodes([
        'node1' as NodeId,
        'non-existent' as NodeId,
        'node2' as NodeId,
      ]);
      
      expect(nodes).toHaveLength(2);
      expect(nodes.map(n => n?.id)).toEqual(['node1', 'node2']);
    });

    it('should return empty array for all non-existent nodes', async () => {
      const nodes = await queryService.getNodes(['non1' as NodeId, 'non2' as NodeId]);
      expect(nodes).toEqual([]);
    });
  });

  describe('getChildren', () => {
    it('should retrieve direct children of a node', async () => {
      const children = await queryService.getChildren(rootNodeId);
      
      expect(children).toHaveLength(2);
      expect(children.map(c => c.id)).toContain('node1');
      expect(children.map(c => c.id)).toContain('node2');
    });

    it('should return empty array for leaf nodes', async () => {
      const children = await queryService.getChildren('node2' as NodeId);
      expect(children).toEqual([]);
    });

    it('should support sorting options', async () => {
      const childrenByName = await queryService.getChildren(rootNodeId, {
        sortBy: 'name',
        sortOrder: 'asc',
      });
      
      expect(childrenByName[0].name).toBe('Document 1');
      expect(childrenByName[1].name).toBe('Folder 1');
    });

    it('should support pagination', async () => {
      const page1 = await queryService.getChildren(rootNodeId, {
        limit: 1,
        offset: 0,
      });
      
      const page2 = await queryService.getChildren(rootNodeId, {
        limit: 1,
        offset: 1,
      });
      
      expect(page1).toHaveLength(1);
      expect(page2).toHaveLength(1);
      expect(page1[0].id).not.toBe(page2[0].id);
    });
  });

  describe('getDescendants', () => {
    it('should retrieve all descendants of a node', async () => {
      const descendants = await queryService.getDescendants(rootNodeId);
      
      expect(descendants).toHaveLength(3); // node1, node2, node1-1
      expect(descendants.map(d => d.id)).toContain('node1');
      expect(descendants.map(d => d.id)).toContain('node2');
      expect(descendants.map(d => d.id)).toContain('node1-1');
    });

    it('should respect maxDepth option', async () => {
      const descendants = await queryService.getDescendants(rootNodeId, {
        maxDepth: 1,
      });
      
      expect(descendants).toHaveLength(2); // Only direct children
      expect(descendants.map(d => d.id)).not.toContain('node1-1');
    });

    it('should filter by node types', async () => {
      const documents = await queryService.getDescendants(rootNodeId, {
        includeTypes: ['document'],
      });
      
      expect(documents).toHaveLength(2);
      expect(documents.every(d => d.nodeType === 'document')).toBe(true);
    });

    it('should exclude specific types', async () => {
      const nonDocuments = await queryService.getDescendants(rootNodeId, {
        excludeTypes: ['document'],
      });
      
      expect(nonDocuments).toHaveLength(1);
      expect(nonDocuments[0].nodeType).toBe('folder');
    });
  });

  describe('getAncestors', () => {
    it('should retrieve all ancestors of a node', async () => {
      const ancestors = await queryService.getAncestors('node1-1' as NodeId);
      
      expect(ancestors).toHaveLength(2); // node1 and root
      expect(ancestors[0].id).toBe('node1');
      expect(ancestors[1].id).toBe(rootNodeId);
    });

    it('should return empty array for root node', async () => {
      const ancestors = await queryService.getAncestors(rootNodeId);
      expect(ancestors).toEqual([]);
    });

    it('should handle non-existent nodes', async () => {
      const ancestors = await queryService.getAncestors('non-existent' as NodeId);
      expect(ancestors).toEqual([]);
    });
  });

  describe('getPath', () => {
    it('should retrieve full path from root to node', async () => {
      const path = await queryService.getPath('node1-1' as NodeId);
      
      expect(path).toHaveLength(3); // root -> node1 -> node1-1
      expect(path[0].id).toBe(rootNodeId);
      expect(path[1].id).toBe('node1');
      expect(path[2].id).toBe('node1-1');
    });

    it('should return single element for root node', async () => {
      const path = await queryService.getPath(rootNodeId);
      expect(path).toHaveLength(1);
      expect(path[0].id).toBe(rootNodeId);
    });
  });

  describe('searchNodes', () => {
    it('should search nodes by query in name', async () => {
      const results = await queryService.searchNodes('Document');
      
      expect(results).toHaveLength(2);
      expect(results.every(r => r.name.includes('Document'))).toBe(true);
    });

    it('should search in description when enabled', async () => {
      const results = await queryService.searchNodes('test', {
        searchInDescription: true,
      });
      
      expect(results).toHaveLength(2); // Nodes with 'test' in description
    });

    it('should support case-sensitive search', async () => {
      const caseSensitive = await queryService.searchNodes('document', {
        caseSensitive: true,
      });
      expect(caseSensitive).toHaveLength(0);
      
      const caseInsensitive = await queryService.searchNodes('document', {
        caseSensitive: false,
      });
      expect(caseInsensitive).toHaveLength(2);
    });

    it('should support regex search', async () => {
      const results = await queryService.searchNodes('^Folder.*', {
        useRegex: true,
      });
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Folder 1');
    });

    it('should restrict search to subtree', async () => {
      const results = await queryService.searchNodes('Document', {
        rootNodeId: 'node1' as NodeId,
      });
      
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('node1-1');
    });
  });

  describe('exists', () => {
    it('should return true for existing nodes', async () => {
      const exists = await queryService.exists('node1' as NodeId);
      expect(exists).toBe(true);
    });

    it('should return false for non-existent nodes', async () => {
      const exists = await queryService.exists('non-existent' as NodeId);
      expect(exists).toBe(false);
    });
  });

  describe('hasChildren', () => {
    it('should return true for nodes with children', async () => {
      const hasChildren = await queryService.hasChildren(rootNodeId);
      expect(hasChildren).toBe(true);
    });

    it('should return false for leaf nodes', async () => {
      const hasChildren = await queryService.hasChildren('node2' as NodeId);
      expect(hasChildren).toBe(false);
    });
  });

  describe('getNodeCount', () => {
    it('should return total count of nodes in tree', async () => {
      const count = await queryService.getNodeCount({
        treeId: testTreeId,
      });
      expect(count).toBe(4);
    });

    it('should count nodes by type', async () => {
      const folderCount = await queryService.getNodeCount({
        nodeType: 'folder',
      });
      expect(folderCount).toBe(2);
      
      const documentCount = await queryService.getNodeCount({
        nodeType: 'document',
      });
      expect(documentCount).toBe(2);
    });

    it('should count nodes in subtree', async () => {
      const subtreeCount = await queryService.getNodeCount({
        parentId: 'node1' as NodeId,
      });
      expect(subtreeCount).toBe(1);
    });
  });

  describe('getTreeStats', () => {
    it('should return comprehensive tree statistics', async () => {
      const stats = await queryService.getTreeStats(testTreeId);
      
      expect(stats.totalNodes).toBe(4);
      expect(stats.depth).toBe(3); // root -> node1 -> node1-1
      expect(stats.nodesByType).toEqual({
        folder: 2,
        document: 2,
      });
      expect(stats.leafNodes).toBe(2);
      expect(stats.averageChildrenPerNode).toBeCloseTo(0.75, 2); // 3 children / 4 nodes
    });
  });
});