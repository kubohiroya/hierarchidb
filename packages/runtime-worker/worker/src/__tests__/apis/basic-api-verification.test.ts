/**
 * @file basic-api-verification.test.ts
 * @description Simple verification tests for WorkerAPI implementation
 */

import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { WorkerAPIImpl } from '../../WorkerAPIImpl';

describe('Basic API Verification', () => {
  let workerAPI: WorkerAPIImpl;

  beforeAll(async () => {
    // Initialize WorkerAPI with a unique database name for testing
    workerAPI = await WorkerAPIImpl.getSingleton(`test-db-${Date.now()}`);
  });

  afterAll(async () => {
    await workerAPI.shutdown();
  });

  describe('API availability', () => {
    it('should have TreeQueryAPI available', () => {
      const queryAPI = workerAPI.getQueryAPI();
      expect(queryAPI).toBeDefined();
    });

    it('should have TreeMutationAPI available', () => {
      const mutationAPI = workerAPI.getMutationAPI();
      expect(mutationAPI).toBeDefined();
    });

    it('should have TreeSubscriptionAPI available', () => {
      const subscriptionAPI = workerAPI.getSubscriptionAPI();
      expect(subscriptionAPI).toBeDefined();
    });

    it('should have NodeTypeAPI available', () => {
      const nodeTypeAPI = workerAPI.getNodeTypeAPI();
      expect(nodeTypeAPI).toBeDefined();
    });

    it('should have PluginTreeAPI available', () => {
      const pluginTreeAPI = workerAPI.getPluginTreeAPI();
      expect(pluginTreeAPI).toBeDefined();
    });

    it('should have PluginManagementAPI available', () => {
      const pluginManagementAPI = workerAPI.getPluginManagementAPI();
      expect(pluginManagementAPI).toBeDefined();
    });

    it('should have PluginRegistryAPI available', () => {
      const pluginRegistryAPI = workerAPI.getPluginRegistryAPI();
      expect(pluginRegistryAPI).toBeDefined();
    });

    it('should have WorkingCopyAPI available', () => {
      const workingCopyAPI = workerAPI.getWorkingCopyAPI();
      expect(workingCopyAPI).toBeDefined();
    });
  });

  describe('Basic functionality', () => {
    it('should respond to ping', () => {
      const response = workerAPI.ping();
      expect(response.response).toBe('pong');
      expect(response.timestamp).toBeTypeOf('number');
    });

    it('should provide system health information', async () => {
      const health = await workerAPI.getSystemHealth();
      expect(health).toHaveProperty('databases');
      expect(health).toHaveProperty('services');
      expect(health).toHaveProperty('memory');
      expect(health).toHaveProperty('uptime');

      // Check that databases are initialized
      expect(health.databases.coreDB).toBe(true);
      expect(health.databases.ephemeralDB).toBe(true);

      // Check that core services are available
      expect(health.services.query).toBe(true);
      expect(health.services.mutation).toBe(true);
      expect(health.services.subscription).toBe(true);
      expect(health.services.plugin).toBe(true);
      expect(health.services.workingCopy).toBe(true);
    });

    it('should list default trees', async () => {
      const trees = await workerAPI.listTrees();
      expect(Array.isArray(trees)).toBe(true);

      // Default setup should have Resources and Projects trees
      expect(trees.length).toBeGreaterThanOrEqual(2);

      const treeNames = trees.map((t) => t.name);
      expect(treeNames).toContain('Resources');
      expect(treeNames).toContain('Projects');
    });
  });

  describe('TreeQuery Service Basics', () => {
    it('should retrieve a tree by ID', async () => {
      const trees = await workerAPI.listTrees();
      if (trees.length > 0) {
        const firstTree = trees[0];
        const retrievedTree = await workerAPI.getTree({ treeId: firstTree.id });

        expect(retrievedTree).toBeDefined();
        expect(retrievedTree!.id).toBe(firstTree.id);
        expect(retrievedTree!.name).toBe(firstTree.name);
      }
    });

    it('should return null for non-existent tree', async () => {
      const nonExistentTree = await workerAPI.getTree({ treeId: 'non-existent' as any });
      expect(nonExistentTree).toBeUndefined();
    });

    it('should get children of root node', async () => {
      const trees = await workerAPI.listTrees();
      if (trees.length > 0) {
        const firstTree = trees[0];
        const children = await workerAPI.getChildren({ parentId: firstTree.rootId });

        expect(Array.isArray(children)).toBe(true);
        // Root might have no children initially, so just verify it returns an array
      }
    });
  });

  describe('WorkingCopyTypes Service Basics', () => {
    it('should list working copies (initially empty)', async () => {
      const workingCopyAPI = workerAPI.getWorkingCopyAPI();
      const workingCopies = await workingCopyAPI.listWorkingCopies();

      expect(Array.isArray(workingCopies)).toBe(true);
      // Initially should be empty
      expect(workingCopies.length).toBe(0);
    });

    it('should provide working copy stats', async () => {
      const workingCopyAPI = workerAPI.getWorkingCopyAPI();
      const stats = await workingCopyAPI.getWorkingCopyStats();

      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('drafts');
      expect(stats).toHaveProperty('edits');
      expect(stats).toHaveProperty('oldestTimestamp');
      expect(stats).toHaveProperty('newestTimestamp');

      expect(typeof stats.total).toBe('number');
      expect(typeof stats.drafts).toBe('number');
      expect(typeof stats.edits).toBe('number');
    });
  });
});
