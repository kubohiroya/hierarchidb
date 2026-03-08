// Mock utilities for testing integration with existing systems

import type { 
  SessionState, 
  TaskSnapshot, 
  SessionHandle,
  BuildMetadata 
} from '../types/SessionTypes.js';
import type { CapturedEvent, NotificationType } from '../types/EventTypes.js';

/**
 * Mock utilities for creating test data and simulating system behavior
 */
export class MockUtils {
  /**
   * Create a mock session state
   */
  static createMockSessionState(overrides: Partial<SessionState> = {}): SessionState {
    const defaults: SessionState = {
      sessionId: `mock-session-${Date.now()}`,
      nodeId: `mock-node-${Date.now()}`,
      status: 'running',
      currentStage: 'parallel-execution',
      taskProgress: {
        'task-1': { taskId: 'task-1', status: 'completed', progress: 100 },
        'task-2': { taskId: 'task-2', status: 'running', progress: 50 },
        'task-3': { taskId: 'task-3', status: 'pending', progress: 0 }
      },
      startTime: Date.now() - 60000,
      lastUpdateTime: Date.now()
    };

    return { ...defaults, ...overrides };
  }

  /**
   * Create a mock task snapshot
   */
  static createMockTaskSnapshot(overrides: Partial<TaskSnapshot> = {}): TaskSnapshot {
    const defaults: TaskSnapshot = {
      nodeId: `mock-node-${Date.now()}`,
      stage: 'task-creation',
      tasks: [
        { taskId: 'task-1', name: 'Mock Task 1', stage: 'parallel-execution' },
        { taskId: 'task-2', name: 'Mock Task 2', stage: 'parallel-execution' },
        { taskId: 'task-3', name: 'Mock Task 3', stage: 'aggregation' }
      ],
      generatedAt: Date.now(),
      metadata: {
        nodeId: `mock-node-${Date.now()}`,
        buildType: 'new',
        stages: ['initialization', 'metadata-generation', 'task-creation']
      } as BuildMetadata
    };

    return { ...defaults, ...overrides };
  }

  /**
   * Create a mock captured event
   */
  static createMockCapturedEvent(
    eventType: NotificationType,
    sequenceNumber: number,
    overrides: Partial<CapturedEvent> = {}
  ): CapturedEvent {
    const defaults: CapturedEvent = {
      nodeId: `mock-node-${Date.now()}`,
      eventType,
      sequenceNumber,
      timestamp: Date.now(),
      payload: { mockData: true },
      deliveryLatency: Math.random() * 100
    };

    return { ...defaults, ...overrides };
  }

  /**
   * Create a sequence of mock events with proper ordering
   */
  static createMockEventSequence(
    eventType: NotificationType,
    count: number,
    nodeId?: string
  ): CapturedEvent[] {
    const mockNodeId = nodeId || `mock-node-${Date.now()}`;
    const baseTimestamp = Date.now();

    return Array.from({ length: count }, (_, index) => 
      this.createMockCapturedEvent(eventType, index + 1, {
        nodeId: mockNodeId,
        timestamp: baseTimestamp + (index * 100),
        payload: { eventIndex: index, mockData: true }
      })
    );
  }

  /**
   * Create a mock session handle
   */
  static createMockSessionHandle(overrides: Partial<SessionHandle> = {}): SessionHandle {
    const defaults: SessionHandle = {
      sessionId: `mock-session-${Date.now()}`,
      nodeId: `mock-node-${Date.now()}`,
      createdAt: Date.now()
    };

    return { ...defaults, ...overrides };
  }

  /**
   * Create mock build metadata
   */
  static createMockBuildMetadata(overrides: Partial<BuildMetadata> = {}): BuildMetadata {
    const defaults: BuildMetadata = {
      nodeId: `mock-node-${Date.now()}`,
      buildType: 'new',
      stages: ['initialization', 'metadata-generation', 'task-creation', 'parallel-execution'],
      metadata: { mockBuild: true }
    };

    return { ...defaults, ...overrides };
  }

  /**
   * Simulate event delivery latency
   */
  static simulateLatency(minMs: number = 10, maxMs: number = 100): Promise<void> {
    const delay = Math.random() * (maxMs - minMs) + minMs;
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Create a mock UnconditionalEventStreamer interface
   */
  static createMockEventStreamer() {
    const subscribers = new Map<string, Array<(event: unknown) => void>>();
    
    return {
      subscribe: (eventType: NotificationType, callback: (event: unknown) => void) => {
        if (!subscribers.has(eventType)) {
          subscribers.set(eventType, []);
        }
        subscribers.get(eventType)!.push(callback);
        return () => {
          const callbacks = subscribers.get(eventType);
          if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index > -1) {
              callbacks.splice(index, 1);
            }
          }
        };
      },
      
      emit: async (eventType: NotificationType, payload: unknown) => {
        const callbacks = subscribers.get(eventType) || [];
        await Promise.all(callbacks.map(callback => {
          try {
            return Promise.resolve(callback(payload));
          } catch (error) {
            console.error(`Mock event streamer callback error:`, error);
            return Promise.resolve();
          }
        }));
      },
      
      getSubscriberCount: (eventType: NotificationType) => {
        return subscribers.get(eventType)?.length || 0;
      }
    };
  }
}