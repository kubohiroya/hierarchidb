// Property-based testing utilities using fast-check

import fc from 'fast-check';
import type { NodeId, SessionId, TaskId, BuildStage, SessionStatus, TaskStatus } from '../types/SessionTypes.js';
import type { NotificationType } from '../types/EventTypes.js';

/**
 * Property-based testing utilities and generators for fast-check
 */
export class PropertyTestUtils {
  /**
   * Generator for NodeId values
   */
  static nodeId(): fc.Arbitrary<NodeId> {
    return fc.string({ minLength: 1, maxLength: 50 }).map(s => `node-${s}`);
  }

  /**
   * Generator for SessionId values
   */
  static sessionId(): fc.Arbitrary<SessionId> {
    return fc.string({ minLength: 1, maxLength: 50 }).map(s => `session-${s}`);
  }

  /**
   * Generator for TaskId values
   */
  static taskId(): fc.Arbitrary<TaskId> {
    return fc.string({ minLength: 1, maxLength: 50 }).map(s => `task-${s}`);
  }

  /**
   * Generator for BuildStage values
   */
  static buildStage(): fc.Arbitrary<BuildStage> {
    return fc.constantFrom(
      'initialization',
      'metadata-generation',
      'task-creation',
      'parallel-execution',
      'aggregation',
      'completion'
    );
  }

  /**
   * Generator for SessionStatus values
   */
  static sessionStatus(): fc.Arbitrary<SessionStatus> {
    return fc.constantFrom('idle', 'running', 'paused', 'completed', 'error');
  }

  /**
   * Generator for TaskStatus values
   */
  static taskStatus(): fc.Arbitrary<TaskStatus> {
    return fc.constantFrom('pending', 'running', 'completed', 'failed');
  }

  /**
   * Generator for NotificationType values
   */
  static notificationType(): fc.Arbitrary<NotificationType> {
    return fc.constantFrom(
      'session-state',
      'task-progress',
      'stage-snapshot',
      'heartbeat',
      'error'
    );
  }

  /**
   * Generator for progress values (0-100)
   */
  static progress(): fc.Arbitrary<number> {
    return fc.integer({ min: 0, max: 100 });
  }

  /**
   * Generator for timestamps
   */
  static timestamp(): fc.Arbitrary<number> {
    return fc.integer({ min: Date.now() - 86400000, max: Date.now() + 86400000 });
  }

  /**
   * Generator for task progress records
   */
  static taskProgressRecord(): fc.Arbitrary<Record<TaskId, number>> {
    return fc.dictionary(
      this.taskId(),
      this.progress(),
      { minKeys: 0, maxKeys: 10 }
    );
  }

  /**
   * Generator for event sequences with proper ordering
   */
  static eventSequence(length: number): fc.Arbitrary<Array<{ type: NotificationType; sequence: number }>> {
    return fc.array(
      fc.record({
        type: this.notificationType(),
        sequence: fc.nat()
      }),
      { minLength: length, maxLength: length }
    ).map(events => 
      events.map((event, index) => ({
        ...event,
        sequence: index + 1
      }))
    );
  }

  /**
   * Generator for session state data
   */
  static sessionStateData() {
    return fc.record({
      nodeId: this.nodeId(),
      sessionId: this.sessionId(),
      status: this.sessionStatus(),
      currentStage: this.buildStage(),
      taskProgress: this.taskProgressRecord(),
      startTime: this.timestamp(),
      lastUpdateTime: this.timestamp()
    });
  }

  /**
   * Property test configuration with standard settings
   */
  static propertyTestConfig(numRuns: number = 100): fc.Parameters<unknown> {
    return {
      numRuns,
      verbose: true,
      seed: Math.floor(Math.random() * 1000000),
      path: '',
      endOnFailure: false
    };
  }

  /**
   * Create a property test assertion wrapper
   */
  static createPropertyAssertion<T>(
    generator: fc.Arbitrary<T>,
    predicate: (value: T) => boolean,
    description: string,
    numRuns: number = 100
  ): () => void {
    return () => {
      fc.assert(
        fc.property(generator, predicate),
        {
          ...this.propertyTestConfig(numRuns),
          verbose: true
        }
      );
    };
  }
}