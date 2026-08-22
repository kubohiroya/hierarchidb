/**
 * Extended property tests for event delivery system.
 * Tests cover:
 *   Property 24: parallel subscriber isolation
 *   Property 25: error condition handling (subscriber exceptions)
 *   Property 26: performance under load (UIEventBufferManager)
 *   Property 27: edge cases and invalid data
 *
 * Design note: UIEventBufferManager uses FIFO queues for session-state and
 * stage-snapshot events, and per-taskId version gating for task-progress events.
 */

import type { NodeId } from '@hierarchidb/core-types';
import fc from 'fast-check';
import { afterEach, describe, expect, it } from 'vitest';
import type { SessionStatusUpdatedEvent } from '../../common/types/session-events';
import {
  type BufferedEvent,
  UIEventBufferManager,
} from '../../ui/components/build-progress/eventBufferingUI';
import { unconditionalEventStreamer } from '../../worker/api/eventBuffering';

const toNodeId = (s: string): NodeId => s as NodeId;

const PROPERTY_TEST_RUNS = 50;

const makeSessionEvent = (): SessionStatusUpdatedEvent => ({
  type: 'sessionStatusUpdated',
  payload: {
    nodeId: 'n',
    phase: 'running',
    isActive: true,
  },
});

const makeBufferedEvent = (
  notificationType: 'session-state' | 'stage-snapshot'
): BufferedEvent => ({
  notificationType,
  payload: { test: true },
  timestamp: Date.now(),
});

const makeTaskProgressEvent = (value: number): BufferedEvent => ({
  notificationType: 'task-progress',
  payload: { value },
  timestamp: Date.now(),
});

describe('Property 24-27: Extended Event Delivery Scenarios', () => {
  afterEach(() => {
    // individual tests call cleanup per nodeId
  });

  // -----------------------------------------------------------------------
  // Property 24: Parallel subscriber isolation
  // -----------------------------------------------------------------------

  describe('Property 24: Parallel subscriber isolation', () => {
    it('multiple subscribers on the same node all receive every event', () => {
      fc.assert(
        fc.property(
          fc.record({
            nodeId: fc.string({ minLength: 1, maxLength: 10 }),
            subscriberCount: fc.integer({ min: 2, max: 5 }),
            eventCount: fc.integer({ min: 1, max: 10 }),
          }),
          ({ nodeId, subscriberCount, eventCount }) => {
            const node = toNodeId(nodeId);
            const received: number[] = Array(subscriberCount).fill(0);

            const unsubs = Array.from({ length: subscriberCount }, (_, i) =>
              unconditionalEventStreamer.subscribe(node, 'session-state', () => {
                received[i]++;
              })
            );

            const payload = makeSessionEvent();
            for (let k = 0; k < eventCount; k++) {
              unconditionalEventStreamer.emitEvent(node, 'session-state', payload);
            }

            for (let i = 0; i < subscriberCount; i++) {
              expect(received[i]).toBe(eventCount);
            }

            unsubs.forEach((u) => u());
            unconditionalEventStreamer.cleanup(node);
          }
        ),
        { numRuns: PROPERTY_TEST_RUNS }
      );
    });

    it('subscribers on different nodes do not interfere', () => {
      fc.assert(
        fc.property(
          fc
            .record({
              nodeIdA: fc.string({ minLength: 1, maxLength: 8 }),
              nodeIdB: fc.string({ minLength: 1, maxLength: 8 }),
              eventCount: fc.integer({ min: 1, max: 10 }),
            })
            .filter(({ nodeIdA, nodeIdB }) => nodeIdA !== nodeIdB),
          ({ nodeIdA, nodeIdB, eventCount }) => {
            const nodeA = toNodeId(nodeIdA);
            const nodeB = toNodeId(nodeIdB);
            let countA = 0;
            let countB = 0;

            const unsubA = unconditionalEventStreamer.subscribe(nodeA, 'session-state', () => {
              countA++;
            });
            const unsubB = unconditionalEventStreamer.subscribe(nodeB, 'session-state', () => {
              countB++;
            });

            const payload = makeSessionEvent();
            for (let k = 0; k < eventCount; k++) {
              unconditionalEventStreamer.emitEvent(nodeA, 'session-state', payload);
            }

            expect(countA).toBe(eventCount);
            expect(countB).toBe(0);

            unsubA();
            unsubB();
            unconditionalEventStreamer.cleanup(nodeA);
            unconditionalEventStreamer.cleanup(nodeB);
          }
        ),
        { numRuns: PROPERTY_TEST_RUNS }
      );
    });

    it('FIFO queues for different notification types are independent under concurrent enqueue', () => {
      fc.assert(
        fc.property(
          fc.record({
            sessionCount: fc.integer({ min: 1, max: 15 }),
            stageCount: fc.integer({ min: 1, max: 15 }),
          }),
          ({ sessionCount, stageCount }) => {
            const mgr = new UIEventBufferManager();

            // Interleave enqueues
            const total = Math.max(sessionCount, stageCount);
            for (let i = 0; i < total; i++) {
              if (i < sessionCount) mgr.enqueue(makeBufferedEvent('session-state'));
              if (i < stageCount) mgr.enqueue(makeBufferedEvent('stage-snapshot'));
            }

            expect(mgr.flushFifo('session-state').length).toBe(sessionCount);
            expect(mgr.flushFifo('stage-snapshot').length).toBe(stageCount);
          }
        ),
        { numRuns: PROPERTY_TEST_RUNS }
      );
    });
  });

  // -----------------------------------------------------------------------
  // Property 25: Error condition handling
  // -----------------------------------------------------------------------

  describe('Property 25: Error condition handling', () => {
    it('subscriber exceptions do not prevent other subscribers from receiving events', () => {
      fc.assert(
        fc.property(
          fc.record({
            nodeId: fc.string({ minLength: 1, maxLength: 10 }),
            subscriberCount: fc.integer({ min: 2, max: 5 }),
            failingIndex: fc.integer({ min: 0, max: 4 }),
            eventCount: fc.integer({ min: 1, max: 5 }),
          }),
          ({ nodeId, subscriberCount, failingIndex, eventCount }) => {
            const node = toNodeId(nodeId);
            const successCounts: number[] = Array(subscriberCount).fill(0);
            const actualFailingIndex = failingIndex % subscriberCount;

            const unsubs = Array.from({ length: subscriberCount }, (_, i) =>
              unconditionalEventStreamer.subscribe(node, 'session-state', () => {
                if (i === actualFailingIndex) {
                  throw new Error(`subscriber ${i} failed`);
                }
                successCounts[i]++;
              })
            );

            const payload = makeSessionEvent();
            for (let k = 0; k < eventCount; k++) {
              unconditionalEventStreamer.emitEvent(node, 'session-state', payload);
            }

            // Non-failing subscribers must still receive all events
            for (let i = 0; i < subscriberCount; i++) {
              if (i !== actualFailingIndex) {
                expect(successCounts[i]).toBe(eventCount);
              }
            }

            unsubs.forEach((u) => u());
            unconditionalEventStreamer.cleanup(node);
          }
        ),
        { numRuns: PROPERTY_TEST_RUNS }
      );
    });

    it('enqueue with unknown notification type throws immediately', () => {
      fc.assert(
        fc.property(fc.constantFrom('unknown-type', 'invalid', 'bad'), (wrongType) => {
          const mgr = new UIEventBufferManager();
          let threw = false;
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            mgr.enqueue({ notificationType: wrongType as any, payload: {}, timestamp: Date.now() });
          } catch {
            threw = true;
          }
          expect(threw).toBe(true);
        }),
        { numRuns: PROPERTY_TEST_RUNS }
      );
    });
  });

  // -----------------------------------------------------------------------
  // Property 26: Performance under load
  // -----------------------------------------------------------------------

  describe('Property 26: Performance under load', () => {
    it('UIEventBufferManager handles large FIFO batches correctly', () => {
      fc.assert(
        fc.property(
          fc.record({
            batchSize: fc.integer({ min: 50, max: 200 }),
            batchCount: fc.integer({ min: 2, max: 5 }),
          }),
          ({ batchSize, batchCount }) => {
            const mgr = new UIEventBufferManager();
            let totalEnqueued = 0;

            for (let b = 0; b < batchCount; b++) {
              for (let i = 0; i < batchSize; i++) {
                mgr.enqueue(makeBufferedEvent('session-state'));
                totalEnqueued++;
              }
            }

            const flushed = mgr.flushFifo('session-state');
            expect(flushed.length).toBe(totalEnqueued);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('task-progress per-taskId deduplication handles rapid successive events', () => {
      fc.assert(
        fc.property(fc.integer({ min: 10, max: 100 }), (eventCount) => {
          const mgr = new UIEventBufferManager();
          let accepted = 0;

          // Monotonically increasing versions — all must be accepted
          for (let i = 1; i <= eventCount; i++) {
            const result = mgr.applyTaskProgress('task-1', i);
            if (result) accepted++;
          }

          expect(accepted).toBe(eventCount);
        }),
        { numRuns: 20 }
      );
    });
  });

  // -----------------------------------------------------------------------
  // Property 27: Edge cases and invalid data
  // -----------------------------------------------------------------------

  describe('Property 27: Edge cases and invalid data', () => {
    it('flushFifo on empty queue returns empty array', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<'session-state' | 'stage-snapshot'>('session-state', 'stage-snapshot'),
          (type) => {
            const mgr = new UIEventBufferManager();
            expect(mgr.flushFifo(type)).toEqual([]);
          }
        ),
        { numRuns: PROPERTY_TEST_RUNS }
      );
    });

    it('emitting to a node with no subscribers does not throw', () => {
      fc.assert(
        fc.property(
          fc.record({
            nodeId: fc.string({ minLength: 1, maxLength: 10 }),
            eventCount: fc.integer({ min: 1, max: 5 }),
          }),
          ({ nodeId, eventCount }) => {
            const node = toNodeId(nodeId);
            const payload = makeSessionEvent();
            expect(() => {
              for (let k = 0; k < eventCount; k++) {
                unconditionalEventStreamer.emitEvent(node, 'session-state', payload);
              }
            }).not.toThrow();
          }
        ),
        { numRuns: PROPERTY_TEST_RUNS }
      );
    });

    it('cleanup on a node with no subscribers does not throw', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 10 }), (nodeId) => {
          expect(() => {
            unconditionalEventStreamer.cleanup(toNodeId(nodeId));
          }).not.toThrow();
        }),
        { numRuns: PROPERTY_TEST_RUNS }
      );
    });

    it('calling unsubscribe twice does not throw', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 10 }), (nodeId) => {
          const node = toNodeId(nodeId);
          const unsub = unconditionalEventStreamer.subscribe(node, 'session-state', () => {});
          expect(() => {
            unsub();
            unsub();
          }).not.toThrow();
          unconditionalEventStreamer.cleanup(node);
        }),
        { numRuns: PROPERTY_TEST_RUNS }
      );
    });

    it('task-progress accepts the first version for independent task IDs', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 20 }), (count) => {
          const mgr = new UIEventBufferManager();
          for (let i = 1; i <= count; i++) {
            expect(mgr.applyTaskProgress(`task-${i}`, 1)).toBe(true);
          }
        }),
        { numRuns: PROPERTY_TEST_RUNS }
      );
    });

    it('reset followed by immediate use works correctly', () => {
      fc.assert(
        fc.property(
          fc.record({
            resetCount: fc.integer({ min: 1, max: 5 }),
            eventsAfterLastReset: fc.integer({ min: 1, max: 10 }),
          }),
          ({ resetCount, eventsAfterLastReset }) => {
            const mgr = new UIEventBufferManager();

            for (let r = 0; r < resetCount; r++) {
              mgr.enqueue(makeBufferedEvent('session-state'));
              mgr.reset();
            }

            for (let i = 0; i < eventsAfterLastReset; i++) {
              mgr.enqueue(makeBufferedEvent('session-state'));
            }

            expect(mgr.flushFifo('session-state').length).toBe(eventsAfterLastReset);
          }
        ),
        { numRuns: PROPERTY_TEST_RUNS }
      );
    });
  });
});
