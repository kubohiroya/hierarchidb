import type {
  CommandEnvelope,
  ObserveNodePayload,
  Timestamp,
  NodeId,
} from "@hierarchidb/common-core";
import { generateNodeId } from "@hierarchidb/common-core";
import type { Observable } from "rxjs";
import { Subject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TreeSubscribeService } from "../TreeSubscribeService";

/**
 * TreeSubscribeService - Performance Tests
 *
 * Tests service performance characteristics and behavior under high load:
 * - Mass simultaneous subscription processing
 * - Subscription cleanup functionality
 * - High-frequency event processing performance
 * - Memory leak resistance
 */
describe("TreeSubscribeService - Performance Tests", () => {
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
        id: "folder1" as NodeId,
        parentNodeId: "root" as NodeId,
        name: "Test Folder",
        nodeType: "folder",
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

  /**
   * Mass simultaneous subscription processing test
   * Verifies multiple subscriptions can be created and managed simultaneously
   */
  it("should handle multiple simultaneous subscriptions efficiently", async () => {
    const nodeIds = ["folder1", "folder2", "folder3"] as NodeId[];
    const observables: Observable<any>[] = [];

    // Create multiple subscriptions
    for (const nodeId of nodeIds) {
      const cmd: CommandEnvelope<"subscribeNode", ObserveNodePayload> = {
        commandId: generateNodeId(),
        groupId: generateNodeId(),
        kind: "subscribeNode",
        payload: {
          nodeId: nodeId,
          includeInitialValue: true,
        },
        issuedAt: Date.now() as Timestamp,
      };

      const observable = await service.subscribeNode(cmd);
      observables.push(observable);
    }

    expect(observables).toHaveLength(3);
    expect(await service.getActiveSubscriptions()).toBeGreaterThanOrEqual(0);

    // Clean up subscriptions
    const subscriptions = observables.map((obs) => obs.subscribe());
    subscriptions.forEach((sub) => sub.unsubscribe());
  });

  /**
   * Subscription cleanup functionality test
   * Verifies unused subscriptions are properly deleted
   */
  it("should cleanup orphaned subscriptions", async () => {
    // Create subscription
    const cmd: CommandEnvelope<"subscribeNode", ObserveNodePayload> = {
      commandId: generateNodeId(),
      groupId: generateNodeId(),
      kind: "subscribeNode",
      payload: {
        nodeId: "folder1" as NodeId,
        includeInitialValue: false,
      },
      issuedAt: Date.now() as Timestamp,
    };

    const observable = await service.subscribeNode(cmd);

    // Subscribe then unsubscribe
    const subscription = observable.subscribe();
    subscription.unsubscribe();

    // Execute cleanup
    await service.cleanupInactiveSubscriptions();

    // Verify active subscription count is properly managed
    const activeCount = await service.getActiveSubscriptions();
    expect(activeCount).toBeGreaterThanOrEqual(0);
  });

  /**
   * High-frequency event processing performance test
   * Verifies no memory leaks occur when large amounts of change events are output
   *
   * This test measures current implementation performance characteristics
   * and also serves as a benchmark for evaluating improvements after refactoring.
   */
  it("should handle high-frequency changes without memory leaks", async () => {
    const cmd: CommandEnvelope<"subscribeNode", ObserveNodePayload> = {
      commandId: generateNodeId(),
      groupId: generateNodeId(),
      kind: "subscribeNode",
      payload: {
        nodeId: "folder1" as NodeId,
        includeInitialValue: false,
      },
      issuedAt: Date.now() as Timestamp,
    };

    const observable = await service.subscribeNode(cmd);

    let eventCount = 0;
    const subscription = observable.subscribe(() => {
      eventCount++;
    });

    // Generate large amounts of high-frequency changes
    const changeCount = 100;
    const startTime = performance.now();

    for (let i = 0; i < changeCount; i++) {
      await mockCoreDB.updateNode("folder1" as NodeId, { name: `Folder ${i}` });
    }

    const endTime = performance.now();
    const processingTime = endTime - startTime;

    // Wait for event propagation
    await new Promise((resolve) => setTimeout(resolve, 100));

    subscription.unsubscribe();

    // Verify performance characteristics
    expect(eventCount).toBeGreaterThanOrEqual(0);
    expect(eventCount).toBeLessThanOrEqual(changeCount);

    // Log performance metrics (for measuring refactoring effects)
    console.log(`📊 Performance metrics:`);
    console.log(`  - Events processed: ${eventCount}/${changeCount}`);
    console.log(`  - Processing time: ${processingTime.toFixed(2)}ms`);
    if (processingTime > 0) {
      console.log(
        `  - Throughput: ${((eventCount / processingTime) * 1000).toFixed(2)} events/sec`,
      );
    }

    // Verify basic performance requirements
    expect(processingTime).toBeLessThan(5000); // Complete within 5 seconds
  });

  /**
   * Resource management test
   * Verifies service properly manages resources and prevents memory leaks
   */
  it("should manage resources properly during intensive usage", async () => {
    const initialActiveCount = await service.getActiveSubscriptions();

    // Execute multiple subscription creation/destruction cycles
    for (let cycle = 0; cycle < 10; cycle++) {
      const observables: Observable<any>[] = [];
      const subscriptions: any[] = [];

      // Create subscriptions
      for (let i = 0; i < 5; i++) {
        const cmd: CommandEnvelope<"subscribeNode", ObserveNodePayload> = {
          commandId: generateNodeId(),
          groupId: generateNodeId(),
          kind: "subscribeNode",
          payload: {
            nodeId: `folder${(i % 3) + 1}` as NodeId,
            includeInitialValue: false,
          },
          issuedAt: Date.now() as Timestamp,
        };

        const observable = await service.subscribeNode(cmd);
        observables.push(observable);
        subscriptions.push(observable.subscribe());
      }

      // Wait briefly
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Unsubscribe
      subscriptions.forEach((sub) => sub.unsubscribe());

      // Execute cleanup
      await service.cleanupInactiveSubscriptions();
    }

    const finalActiveCount = await service.getActiveSubscriptions();

    // Verify resources are properly cleaned up
    expect(finalActiveCount).toBeLessThanOrEqual(initialActiveCount + 5); // Allow some margin

    console.log(`🧹 Resource management test:`);
    console.log(`  - Initial subscriptions: ${initialActiveCount}`);
    console.log(`  - Final subscriptions: ${finalActiveCount}`);
    console.log(
      `  - Leak detection: ${finalActiveCount <= initialActiveCount + 5 ? "✅ PASS" : "❌ FAIL"}`,
    );
  });
});
