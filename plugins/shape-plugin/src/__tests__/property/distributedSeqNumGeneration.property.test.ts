/**
 * Property tests for unconditional event streaming delivery guarantees.
 * Replaces the old DistributedSeqNumGenerator tests (removed in the
 * FIFO+version-gate redesign).  The current Worker-side API is:
 *   unconditionalEventStreamer.subscribe / emitEvent / emitHeartbeat / cleanup
 * There is no sequence numbering — ordering is guaranteed by the single-threaded
 * Worker execution model.
 */

import type { NodeId } from '@hierarchidb/core-types';
import fc from 'fast-check';
import { afterEach, describe, expect, it } from 'vitest';
import type { EventPayload, NotificationType } from '../../worker/api/eventBuffering';
import { unconditionalEventStreamer } from '../../worker/api/eventBuffering';

const toNodeId = (s: string): NodeId => s as NodeId;

const PROPERTY_TEST_RUNS = 50;

// Minimal valid payloads per event type
const makePayload = (eventType: NotificationType): EventPayload => {
  switch (eventType) {
    case 'session-state':
      return { nodeId: 'n' as NodeId, sessionId: 's', state: 'running' } as EventPayload;
    case 'stage-snapshot':
      return {
        nodeId: 'n' as NodeId,
        sessionId: 's',
        stageId: 'st',
        tasks: [],
      } as unknown as EventPayload;
    case 'task-progress':
      return {
        nodeId: 'n' as NodeId,
        sessionId: 's',
        taskId: 't',
        value: 0,
      } as unknown as EventPayload;
    case 'worker-log':
      return {
        nodeId: 'n' as NodeId,
        sessionId: 's',
        level: 'info',
        message: 'x',
      } as unknown as EventPayload;
    case 'critical-error':
      return { nodeId: 'n' as NodeId, sessionId: 's', error: 'e' } as unknown as EventPayload;
    case 'heartbeat':
      return { nodeId: 'n' as NodeId, heartbeatAt: Date.now() } as unknown as EventPayload;
  }
};

describe('Property: UnconditionalEventStreamer delivery guarantees', () => {
  afterEach(() => {
    // nothing to clean up globally; each test calls cleanup per nodeId
  });

  describe('All emitted events are delivered to subscribers', () => {
    it('should deliver every emitted event to every subscriber', () => {
      fc.assert(
        fc.property(
          fc.record({
            nodeId: fc.string({ minLength: 1, maxLength: 10 }),
            eventType: fc.constantFrom<NotificationType>(
              'session-state',
              'stage-snapshot',
              'task-progress',
              'worker-log',
              'critical-error'
            ),
            eventCount: fc.integer({ min: 1, max: 20 }),
            subscriberCount: fc.integer({ min: 1, max: 4 }),
          }),
          ({ nodeId, eventType, eventCount, subscriberCount }) => {
            const node = toNodeId(nodeId);
            const received: EventPayload[][] = Array.from({ length: subscriberCount }, () => []);

            const unsubs = Array.from({ length: subscriberCount }, (_, i) =>
              unconditionalEventStreamer.subscribe(node, eventType, (ev) => {
                received[i].push(ev);
              })
            );

            const payload = makePayload(eventType);
            for (let k = 0; k < eventCount; k++) {
              unconditionalEventStreamer.emitEvent(
                node,
                eventType as Exclude<NotificationType, 'heartbeat'>,
                payload as Exclude<
                  EventPayload,
                  import('~/common/types/session-events').SessionHeartbeatEvent
                >
              );
            }

            // Every subscriber must have received every event
            for (let i = 0; i < subscriberCount; i++) {
              expect(received[i].length).toBe(eventCount);
            }

            unsubs.forEach((u) => u());
            unconditionalEventStreamer.cleanup(node);
          }
        ),
        { numRuns: PROPERTY_TEST_RUNS }
      );
    });

    it('should deliver heartbeat events to heartbeat subscribers', () => {
      fc.assert(
        fc.property(
          fc.record({
            nodeId: fc.string({ minLength: 1, maxLength: 10 }),
            eventCount: fc.integer({ min: 1, max: 10 }),
          }),
          ({ nodeId, eventCount }) => {
            const node = toNodeId(nodeId);
            const received: EventPayload[] = [];

            const unsub = unconditionalEventStreamer.subscribe(node, 'heartbeat', (ev) => {
              received.push(ev);
            });

            for (let k = 0; k < eventCount; k++) {
              unconditionalEventStreamer.emitHeartbeat(node, {
                nodeId: node,
                heartbeatAt: Date.now(),
              } as unknown as import('~/common/types/session-events').SessionHeartbeatEvent);
            }

            expect(received.length).toBe(eventCount);

            unsub();
            unconditionalEventStreamer.cleanup(node);
          }
        ),
        { numRuns: PROPERTY_TEST_RUNS }
      );
    });
  });

  describe('Events emitted before subscribe are not delivered (no buffering)', () => {
    it('should discard events emitted when no subscriber is registered', () => {
      fc.assert(
        fc.property(
          fc.record({
            nodeId: fc.string({ minLength: 1, maxLength: 10 }),
            preEventCount: fc.integer({ min: 1, max: 10 }),
            postEventCount: fc.integer({ min: 1, max: 10 }),
          }),
          ({ nodeId, preEventCount, postEventCount }) => {
            const node = toNodeId(nodeId);
            const received: EventPayload[] = [];
            const payload = makePayload('session-state');

            // Emit before subscribing — must be discarded
            for (let k = 0; k < preEventCount; k++) {
              unconditionalEventStreamer.emitEvent(
                node,
                'session-state',
                payload as Exclude<
                  EventPayload,
                  import('~/common/types/session-events').SessionHeartbeatEvent
                >
              );
            }

            const unsub = unconditionalEventStreamer.subscribe(node, 'session-state', (ev) => {
              received.push(ev);
            });

            // Emit after subscribing — must be delivered
            for (let k = 0; k < postEventCount; k++) {
              unconditionalEventStreamer.emitEvent(
                node,
                'session-state',
                payload as Exclude<
                  EventPayload,
                  import('~/common/types/session-events').SessionHeartbeatEvent
                >
              );
            }

            expect(received.length).toBe(postEventCount);

            unsub();
            unconditionalEventStreamer.cleanup(node);
          }
        ),
        { numRuns: PROPERTY_TEST_RUNS }
      );
    });
  });

  describe('Unsubscribe stops delivery', () => {
    it('should stop delivering events after unsubscribe', () => {
      fc.assert(
        fc.property(
          fc.record({
            nodeId: fc.string({ minLength: 1, maxLength: 10 }),
            beforeCount: fc.integer({ min: 1, max: 10 }),
            afterCount: fc.integer({ min: 1, max: 10 }),
          }),
          ({ nodeId, beforeCount, afterCount }) => {
            const node = toNodeId(nodeId);
            const received: EventPayload[] = [];
            const payload = makePayload('worker-log');

            const unsub = unconditionalEventStreamer.subscribe(node, 'worker-log', (ev) => {
              received.push(ev);
            });

            for (let k = 0; k < beforeCount; k++) {
              unconditionalEventStreamer.emitEvent(
                node,
                'worker-log',
                payload as Exclude<
                  EventPayload,
                  import('~/common/types/session-events').SessionHeartbeatEvent
                >
              );
            }

            unsub();

            for (let k = 0; k < afterCount; k++) {
              unconditionalEventStreamer.emitEvent(
                node,
                'worker-log',
                payload as Exclude<
                  EventPayload,
                  import('~/common/types/session-events').SessionHeartbeatEvent
                >
              );
            }

            expect(received.length).toBe(beforeCount);

            unconditionalEventStreamer.cleanup(node);
          }
        ),
        { numRuns: PROPERTY_TEST_RUNS }
      );
    });
  });

  describe('cleanup removes all subscribers for a node', () => {
    it('should deliver no events after cleanup', () => {
      fc.assert(
        fc.property(
          fc.record({
            nodeId: fc.string({ minLength: 1, maxLength: 10 }),
            eventCount: fc.integer({ min: 1, max: 10 }),
          }),
          ({ nodeId, eventCount }) => {
            const node = toNodeId(nodeId);
            const received: EventPayload[] = [];
            const payload = makePayload('critical-error');

            unconditionalEventStreamer.subscribe(node, 'critical-error', (ev) => {
              received.push(ev);
            });

            unconditionalEventStreamer.cleanup(node);

            for (let k = 0; k < eventCount; k++) {
              unconditionalEventStreamer.emitEvent(
                node,
                'critical-error',
                payload as Exclude<
                  EventPayload,
                  import('~/common/types/session-events').SessionHeartbeatEvent
                >
              );
            }

            expect(received.length).toBe(0);
          }
        ),
        { numRuns: PROPERTY_TEST_RUNS }
      );
    });
  });

  describe('Event type isolation', () => {
    it('should only deliver events to subscribers of the matching event type', () => {
      fc.assert(
        fc.property(
          fc.record({
            nodeId: fc.string({ minLength: 1, maxLength: 10 }),
            eventCount: fc.integer({ min: 1, max: 10 }),
          }),
          ({ nodeId, eventCount }) => {
            const node = toNodeId(nodeId);
            const sessionReceived: EventPayload[] = [];
            const stageReceived: EventPayload[] = [];

            const unsub1 = unconditionalEventStreamer.subscribe(node, 'session-state', (ev) => {
              sessionReceived.push(ev);
            });
            const unsub2 = unconditionalEventStreamer.subscribe(node, 'stage-snapshot', (ev) => {
              stageReceived.push(ev);
            });

            const sessionPayload = makePayload('session-state');
            for (let k = 0; k < eventCount; k++) {
              unconditionalEventStreamer.emitEvent(
                node,
                'session-state',
                sessionPayload as Exclude<
                  EventPayload,
                  import('~/common/types/session-events').SessionHeartbeatEvent
                >
              );
            }

            // stage-snapshot subscriber must not receive session-state events
            expect(sessionReceived.length).toBe(eventCount);
            expect(stageReceived.length).toBe(0);

            unsub1();
            unsub2();
            unconditionalEventStreamer.cleanup(node);
          }
        ),
        { numRuns: PROPERTY_TEST_RUNS }
      );
    });
  });

  describe('Node isolation', () => {
    it('should not deliver events across different nodes', () => {
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
            const receivedA: EventPayload[] = [];
            const receivedB: EventPayload[] = [];

            const unsubA = unconditionalEventStreamer.subscribe(nodeA, 'session-state', (ev) => {
              receivedA.push(ev);
            });
            const unsubB = unconditionalEventStreamer.subscribe(nodeB, 'session-state', (ev) => {
              receivedB.push(ev);
            });

            const payload = makePayload('session-state');
            for (let k = 0; k < eventCount; k++) {
              unconditionalEventStreamer.emitEvent(
                nodeA,
                'session-state',
                payload as Exclude<
                  EventPayload,
                  import('~/common/types/session-events').SessionHeartbeatEvent
                >
              );
            }

            expect(receivedA.length).toBe(eventCount);
            expect(receivedB.length).toBe(0);

            unsubA();
            unsubB();
            unconditionalEventStreamer.cleanup(nodeA);
            unconditionalEventStreamer.cleanup(nodeB);
          }
        ),
        { numRuns: PROPERTY_TEST_RUNS }
      );
    });
  });
});
