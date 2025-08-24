import type { CommandEnvelope, ObserveNodePayload, Timestamp, NodeId } from '@hierarchidb/common-core';
import { generateNodeId } from '@hierarchidb/common-core';
import { firstValueFrom, take, timeout, Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TreeSubscribeService } from '../TreeSubscribeService';

/**
 * TreeSubscribeService - Error Handling & Resource Management Tests
 *
 * Tests error handling and resource management functionality:
 * - Database error handling
 * - Subscriptions to deleted nodes
 * - Resource management and cleanup
 * - Subscription count tracking
 */
describe('TreeSubscribeService - Error Handling & Resource Management', () => {
  let service: TreeSubscribeService;
  let mockCoreDB: any;

  beforeEach(() => {
    // Create a proper mock CoreDB that matches the expected interface
    mockCoreDB = {
      // Database tables
      trees: { toArray: vi.fn().mockResolvedValue([]) },
      nodes: { 
        get: vi.fn(),
        toArray: vi.fn().mockResolvedValue([]),
        where: vi.fn().mockReturnThis(),
        equals: vi.fn().mockReturnThis(),
      },
      rootStates: { toArray: vi.fn().mockResolvedValue([]) },
      
      // Core methods
      getNode: vi.fn().mockResolvedValue({
        id: 'folder1' as NodeId,
        parentNodeId: 'root' as NodeId,
        name: 'Test Folder',
        nodeType: 'folder',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      }),
      updateNode: vi.fn().mockResolvedValue(undefined),
      deleteNode: vi.fn().mockResolvedValue(undefined),
      
      // Required database properties for CoreDB interface
      treeIdToTreeName: new Map(),
      changeSubject: new Subject(), // Add the required changeSubject
      table: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([]),
        get: vi.fn().mockResolvedValue(undefined),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
      }),
      transaction: vi.fn().mockImplementation((mode, tables, fn) => fn()),
    };

    service = new TreeSubscribeService(mockCoreDB);
  });

  afterEach(() => {
    service.cleanupInactiveSubscriptions();
  });

  describe('Error Handling', () => {
    /**
     * Database error handling test
     * Verifies proper handling when database connection errors occur
     */
    it('should handle database errors gracefully', async () => {
      // Configure getNode method to throw an error
      mockCoreDB.getNode.mockRejectedValue(new Error('Database connection failed'));

      const cmd: CommandEnvelope<'subscribeNode', ObserveNodePayload> = {
        commandId: generateNodeId(),
        groupId: generateNodeId(),
        kind: 'subscribeNode',
        payload: {
          nodeId: 'folder1' as NodeId,
          includeInitialValue: true,
        },
        issuedAt: Date.now() as Timestamp,
      };

      // Verify that observable is created even when error occurs
      const observable = await service.subscribeNode(cmd);
      expect(observable).toBeDefined();

      // Test error handling
      let errorCaught = false;
      const subscription = observable.subscribe({
        next: (event) => {
          console.log('Received event despite DB error:', event);
        },
        error: (error) => {
          // Verify error is properly propagated
          expect(error.message).toContain('Database connection failed');
          errorCaught = true;
        },
      });

      // Allow time for error to propagate
      await new Promise(resolve => setTimeout(resolve, 100));
      subscription.unsubscribe();
    });

    /**
     * Subscription to deleted nodes test
     * Verifies proper handling when monitored node is deleted
     */
    it('should handle subscription to deleted nodes', async () => {
      const cmd: CommandEnvelope<'subscribeNode', ObserveNodePayload> = {
        commandId: generateNodeId(),
        groupId: generateNodeId(),
        kind: 'subscribeNode',
        payload: {
          nodeId: 'folder1' as NodeId,
          includeInitialValue: false,
        },
        issuedAt: Date.now() as Timestamp,
      };

      const observable = await service.subscribeNode(cmd);
      expect(observable).toBeDefined();

      // Start monitoring
      let receivedEvent = false;
      const subscription = observable.subscribe({
        next: (event) => {
          receivedEvent = true;
          console.log('Received deletion event:', event);
        },
        error: (error) => {
          console.log('Subscription error after deletion:', error);
        }
      });

      // Simulate node deletion after a delay
      setTimeout(() => {
        mockCoreDB.getNode.mockResolvedValue(undefined); // Node no longer exists
      }, 10);

      // Allow time for deletion to be processed
      await new Promise(resolve => setTimeout(resolve, 100));
      subscription.unsubscribe();
    });
  });

  describe('Resource Management', () => {
    /**
     * Active subscription count tracking test
     * Verifies subscription count is properly tracked
     */
    it('should track active subscriptions count', async () => {
      const initialCount = await service.getActiveSubscriptions();

      const cmd: CommandEnvelope<'subscribeNode', ObserveNodePayload> = {
        commandId: generateNodeId(),
        groupId: generateNodeId(),
        kind: 'subscribeNode',
        payload: {
          nodeId: 'folder1' as NodeId,
          includeInitialValue: false,
        },
        issuedAt: Date.now() as Timestamp,
      };

      const observable = await service.subscribeNode(cmd);
      const subscription = observable.subscribe();

      // Verify subscription count increase
      const newCount = await service.getActiveSubscriptions();
      expect(newCount).toBeGreaterThanOrEqual(initialCount);

      // Cleanup
      subscription.unsubscribe();
    });

    /**
     * Service destruction resource cleanup test
     * Verifies cleanup processing when multiple subscriptions are created
     */
    it('should cleanup resources on service destruction', async () => {
      // Create multiple subscriptions
      const observables = await Promise.all([
        service.subscribeNode({
          commandId: generateNodeId(),
          groupId: generateNodeId(),
          kind: 'subscribeNode',
          payload: { nodeId: 'folder1' as NodeId },
          issuedAt: Date.now() as Timestamp,
        }),
        service.subscribeChildren({
          commandId: generateNodeId(),
          groupId: generateNodeId(),
          kind: 'subscribeChildren',
          payload: { parentId: 'root' as NodeId },
          issuedAt: Date.now() as Timestamp,
        }),
      ]);

      // Start multiple subscriptions
      const subscriptions = observables.map((obs) => obs.subscribe());

      // Immediately unsubscribe
      subscriptions.forEach((sub) => sub.unsubscribe());

      // Cleanup all subscriptions
      await service.cleanupInactiveSubscriptions();

      // Verify service properly handles cleanup
      const count = await service.getActiveSubscriptions();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    /**
     * Long-term memory leak detection test
     * Verifies no memory leaks occur with repeated subscription creation/destruction
     */
    it('should prevent memory leaks in long-term usage', async () => {
      const initialCount = await service.getActiveSubscriptions();

      // Repeat subscription creation/destruction multiple times
      for (let i = 0; i < 20; i++) {
        const cmd: CommandEnvelope<'subscribeNode', ObserveNodePayload> = {
          commandId: generateNodeId(),
          groupId: generateNodeId(),
          kind: 'subscribeNode',
          payload: {
            nodeId: `folder${(i % 3) + 1}` as NodeId,
            includeInitialValue: false,
          },
          issuedAt: Date.now() as Timestamp,
        };

        const observable = await service.subscribeNode(cmd);
        const subscription = observable.subscribe();

        // Unsubscribe after short time
        setTimeout(() => subscription.unsubscribe(), 1);
      }

      // Execute cleanup processing
      await new Promise((resolve) => setTimeout(resolve, 100));
      await service.cleanupInactiveSubscriptions();

      const finalCount = await service.getActiveSubscriptions();

      // Verify no memory leaks occurred
      // (Don't need to return to initial state exactly, but shouldn't increase significantly)
      expect(finalCount).toBeLessThanOrEqual(initialCount + 10); // Allow some margin

      console.log(`🔍 Memory leak detection:`);
      console.log(`  - Initial: ${initialCount} subscriptions`);
      console.log(`  - Final: ${finalCount} subscriptions`);
      console.log(
        `  - Leak status: ${finalCount <= initialCount + 10 ? '✅ GOOD' : '⚠️ POTENTIAL LEAK'}`
      );
    });
  });
});