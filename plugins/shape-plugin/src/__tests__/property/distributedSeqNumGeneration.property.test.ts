/**
 * Property tests for distributed sequence number generation
 * Tests Property 22 for seqNum monotonicity, collision avoidance, and reset behavior
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import {
    DistributedSeqNumGenerator,
    unconditionalEventStreamer,
} from '../../worker/api/eventBuffering';
import type { NodeId } from '@hierarchidb/core-types';

// Test utilities
const createNodeId = (id: string): NodeId => id as NodeId;

// Property test configurations
const PROPERTY_TEST_RUNS = 50;
const MAX_WORKERS = 5;

describe('Property 22: Distributed Sequence Number Generation', () => {
    let generator: DistributedSeqNumGenerator;

    beforeEach(() => {
        generator = new DistributedSeqNumGenerator();
    });

    afterEach(() => {
        // Cleanup any test state
    });

    describe('SeqNum Monotonicity per Notification Type per Node', () => {
        it('should generate monotonic seqNums within each notification type per node', () => {
            fc.assert(
                fc.property(
                    fc.record({
                        nodeId: fc.string({ minLength: 1, maxLength: 10 }),
                        eventType: fc.constantFrom('session-state', 'stage-snapshot', 'task-progress'),
                        eventCount: fc.integer({ min: 2, max: 20 }),
                        workerIndex: fc.integer({ min: 0, max: MAX_WORKERS - 1 }),
                        totalWorkers: fc.integer({ min: 1, max: MAX_WORKERS }),
                    }),
                    ({ nodeId, eventType, eventCount, workerIndex, totalWorkers }) => {
                        // Ensure workerIndex is valid for totalWorkers
                        const validWorkerIndex = workerIndex % totalWorkers;
                        
                        const node = createNodeId(nodeId);
                        
                        // Initialize generator for this node and event type
                        generator.initializeGenerator(node, eventType, validWorkerIndex, totalWorkers);
                        
                        // Generate sequence of seqNums
                        const seqNums: number[] = [];
                        for (let i = 0; i < eventCount; i++) {
                            const seqNum = generator.nextSeqNum(node, eventType);
                            seqNums.push(seqNum);
                        }
                        
                        // Verify monotonicity: each seqNum should be greater than the previous
                        for (let i = 1; i < seqNums.length; i++) {
                            expect(seqNums[i]).toBeGreaterThan(seqNums[i - 1]!);
                        }
                        
                        // Verify distributed formula: workerIndex + (eventCount * totalWorkers)
                        seqNums.forEach((seqNum, index) => {
                            const expectedSeqNum = validWorkerIndex + (index * totalWorkers);
                            expect(seqNum).toBe(expectedSeqNum);
                        });
                    }
                ),
                { numRuns: PROPERTY_TEST_RUNS }
            );
        });

        it('should maintain separate monotonic sequences for different event types', () => {
            fc.assert(
                fc.property(
                    fc.record({
                        nodeId: fc.string({ minLength: 1, maxLength: 10 }),
                        eventTypes: fc.array(
                            fc.constantFrom('session-state', 'stage-snapshot', 'task-progress'),
                            { minLength: 2, maxLength: 3 }
                        ).map(types => Array.from(new Set(types))), // Remove duplicates
                        eventsPerType: fc.integer({ min: 2, max: 10 }),
                        workerIndex: fc.integer({ min: 0, max: MAX_WORKERS - 1 }),
                        totalWorkers: fc.integer({ min: 1, max: MAX_WORKERS }),
                    }),
                    ({ nodeId, eventTypes, eventsPerType, workerIndex, totalWorkers }) => {
                        if (eventTypes.length < 2) return; // Skip if not enough unique event types
                        
                        // Ensure workerIndex is valid for totalWorkers
                        const validWorkerIndex = workerIndex % totalWorkers;
                        
                        const node = createNodeId(nodeId);
                        const seqNumsByType: Record<string, number[]> = {};
                        
                        // Initialize generators for all event types
                        eventTypes.forEach(eventType => {
                            generator.initializeGenerator(node, eventType, validWorkerIndex, totalWorkers);
                            seqNumsByType[eventType] = [];
                        });
                        
                        // Generate seqNums for each event type
                        eventTypes.forEach(eventType => {
                            for (let i = 0; i < eventsPerType; i++) {
                                const seqNum = generator.nextSeqNum(node, eventType);
                                seqNumsByType[eventType]!.push(seqNum);
                            }
                        });
                        
                        // Verify each event type has its own monotonic sequence
                        eventTypes.forEach(eventType => {
                            const seqNums = seqNumsByType[eventType]!;
                            for (let i = 1; i < seqNums.length; i++) {
                                expect(seqNums[i]).toBeGreaterThan(seqNums[i - 1]!);
                            }
                        });
                        
                        // Verify sequences are independent (same pattern but separate counters)
                        const firstTypeSeqNums = seqNumsByType[eventTypes[0]!]!;
                        const secondTypeSeqNums = seqNumsByType[eventTypes[1]!]!;
                        
                        // Both should start with the same workerIndex
                        expect(firstTypeSeqNums[0]).toBe(validWorkerIndex);
                        expect(secondTypeSeqNums[0]).toBe(validWorkerIndex);
                        
                        // Both should follow the same pattern but be independent
                        expect(firstTypeSeqNums[1]).toBe(validWorkerIndex + totalWorkers);
                        expect(secondTypeSeqNums[1]).toBe(validWorkerIndex + totalWorkers);
                    }
                ),
                { numRuns: PROPERTY_TEST_RUNS }
            );
        });
    });

    describe('Parallel Worker SeqNum Collision Avoidance', () => {
        it('should prevent seqNum collisions between parallel workers', () => {
            fc.assert(
                fc.property(
                    fc.record({
                        nodeId: fc.string({ minLength: 1, maxLength: 10 }),
                        eventType: fc.constantFrom('session-state', 'stage-snapshot', 'task-progress'),
                        totalWorkers: fc.integer({ min: 2, max: MAX_WORKERS }),
                        eventsPerWorker: fc.integer({ min: 1, max: 10 }),
                    }),
                    ({ nodeId, eventType, totalWorkers, eventsPerWorker }) => {
                        const node = createNodeId(nodeId);
                        const allSeqNums: number[] = [];
                        const seqNumsByWorker: Record<number, number[]> = {};
                        
                        // Simulate multiple workers generating seqNums
                        for (let workerIndex = 0; workerIndex < totalWorkers; workerIndex++) {
                            const workerGenerator = new DistributedSeqNumGenerator();
                            workerGenerator.initializeGenerator(node, eventType, workerIndex, totalWorkers);
                            
                            seqNumsByWorker[workerIndex] = [];
                            
                            for (let i = 0; i < eventsPerWorker; i++) {
                                const seqNum = workerGenerator.nextSeqNum(node, eventType);
                                seqNumsByWorker[workerIndex]!.push(seqNum);
                                allSeqNums.push(seqNum);
                            }
                        }
                        
                        // Verify no collisions: all seqNums should be unique
                        const uniqueSeqNums = new Set(allSeqNums);
                        expect(uniqueSeqNums.size).toBe(allSeqNums.length);
                        
                        // Verify worker distribution pattern
                        for (let workerIndex = 0; workerIndex < totalWorkers; workerIndex++) {
                            const workerSeqNums = seqNumsByWorker[workerIndex]!;
                            
                            // Each worker's seqNums should follow the pattern: workerIndex + (n * totalWorkers)
                            workerSeqNums.forEach((seqNum, eventIndex) => {
                                const expectedSeqNum = workerIndex + (eventIndex * totalWorkers);
                                expect(seqNum).toBe(expectedSeqNum);
                            });
                            
                            // Verify monotonicity within worker
                            for (let i = 1; i < workerSeqNums.length; i++) {
                                expect(workerSeqNums[i]).toBeGreaterThan(workerSeqNums[i - 1]!);
                            }
                        }
                    }
                ),
                { numRuns: PROPERTY_TEST_RUNS }
            );
        });

        it('should maintain collision avoidance across different nodes', () => {
            fc.assert(
                fc.property(
                    fc.record({
                        nodeIds: fc.array(
                            fc.string({ minLength: 1, maxLength: 10 }),
                            { minLength: 2, maxLength: 3 }
                        ).map(ids => Array.from(new Set(ids))), // Remove duplicates
                        eventType: fc.constantFrom('session-state', 'stage-snapshot', 'task-progress'),
                        totalWorkers: fc.integer({ min: 2, max: 3 }),
                        eventsPerWorker: fc.integer({ min: 1, max: 5 }),
                    }),
                    ({ nodeIds, eventType, totalWorkers, eventsPerWorker }) => {
                        if (nodeIds.length < 2) return; // Skip if not enough unique nodes
                        
                        const seqNumsByNode: Record<string, number[]> = {};
                        
                        // Generate seqNums for each node with multiple workers
                        nodeIds.forEach(nodeIdStr => {
                            const node = createNodeId(nodeIdStr);
                            seqNumsByNode[nodeIdStr] = [];
                            
                            // Simulate multiple workers for this node
                            for (let workerIndex = 0; workerIndex < totalWorkers; workerIndex++) {
                                const nodeGenerator = new DistributedSeqNumGenerator();
                                nodeGenerator.initializeGenerator(node, eventType, workerIndex, totalWorkers);
                                
                                for (let i = 0; i < eventsPerWorker; i++) {
                                    const seqNum = nodeGenerator.nextSeqNum(node, eventType);
                                    seqNumsByNode[nodeIdStr]!.push(seqNum);
                                }
                            }
                        });
                        
                        // Verify each node has independent seqNum sequences
                        nodeIds.forEach(nodeIdStr => {
                            const nodeSeqNums = seqNumsByNode[nodeIdStr]!;
                            
                            // Within each node, seqNums should be unique
                            const uniqueNodeSeqNums = new Set(nodeSeqNums);
                            expect(uniqueNodeSeqNums.size).toBe(nodeSeqNums.length);
                            
                            // Each node should start from worker indices 0, 1, 2, ... totalWorkers-1
                            const sortedSeqNums = [...nodeSeqNums].sort((a, b) => a - b);
                            for (let workerIndex = 0; workerIndex < totalWorkers; workerIndex++) {
                                const workerSeqNums = sortedSeqNums.filter(
                                    seqNum => seqNum % totalWorkers === workerIndex
                                );
                                expect(workerSeqNums.length).toBe(eventsPerWorker);
                            }
                        });
                        
                        // Different nodes can have overlapping seqNums (they're independent)
                        // This is expected behavior - seqNums are unique within node+eventType, not globally
                    }
                ),
                { numRuns: PROPERTY_TEST_RUNS }
            );
        });
    });

    describe('Session Restart SeqNum Reset Behavior', () => {
        it('should reset seqNum counters on session restart', () => {
            fc.assert(
                fc.property(
                    fc.record({
                        nodeId: fc.string({ minLength: 1, maxLength: 10 }),
                        eventTypes: fc.array(
                            fc.constantFrom('session-state', 'stage-snapshot', 'task-progress'),
                            { minLength: 1, maxLength: 3 }
                        ).map(types => Array.from(new Set(types))), // Remove duplicates
                        eventsBeforeReset: fc.integer({ min: 1, max: 10 }),
                        eventsAfterReset: fc.integer({ min: 1, max: 10 }),
                        workerIndex: fc.integer({ min: 0, max: MAX_WORKERS - 1 }),
                        totalWorkers: fc.integer({ min: 1, max: MAX_WORKERS }),
                    }),
                    ({ nodeId, eventTypes, eventsBeforeReset, eventsAfterReset, workerIndex, totalWorkers }) => {
                        // Ensure workerIndex is valid for totalWorkers
                        const validWorkerIndex = workerIndex % totalWorkers;
                        
                        const node = createNodeId(nodeId);
                        
                        // Initialize generators and generate some seqNums
                        const seqNumsBeforeReset: Record<string, number[]> = {};
                        eventTypes.forEach(eventType => {
                            generator.initializeGenerator(node, eventType, validWorkerIndex, totalWorkers);
                            seqNumsBeforeReset[eventType] = [];
                            
                            for (let i = 0; i < eventsBeforeReset; i++) {
                                const seqNum = generator.nextSeqNum(node, eventType);
                                seqNumsBeforeReset[eventType]!.push(seqNum);
                            }
                        });
                        
                        // Reset generators for this node
                        generator.resetGenerator(node);
                        
                        // Re-initialize generators after reset
                        const seqNumsAfterReset: Record<string, number[]> = {};
                        eventTypes.forEach(eventType => {
                            generator.initializeGenerator(node, eventType, validWorkerIndex, totalWorkers);
                            seqNumsAfterReset[eventType] = [];
                            
                            for (let i = 0; i < eventsAfterReset; i++) {
                                const seqNum = generator.nextSeqNum(node, eventType);
                                seqNumsAfterReset[eventType]!.push(seqNum);
                            }
                        });
                        
                        // Verify reset behavior: sequences should start from workerIndex again
                        eventTypes.forEach(eventType => {
                            const beforeReset = seqNumsBeforeReset[eventType]!;
                            const afterReset = seqNumsAfterReset[eventType]!;
                            
                            // Before reset: should have progressed beyond initial workerIndex
                            if (eventsBeforeReset > 1) {
                                expect(beforeReset[beforeReset.length - 1]).toBeGreaterThan(validWorkerIndex);
                            }
                            
                            // After reset: should start from workerIndex again
                            expect(afterReset[0]).toBe(validWorkerIndex);
                            
                            // After reset: should follow the same pattern as initial sequence
                            if (eventsAfterReset > 1) {
                                expect(afterReset[1]).toBe(validWorkerIndex + totalWorkers);
                            }
                        });
                    }
                ),
                { numRuns: PROPERTY_TEST_RUNS }
            );
        });

        it('should reset specific event type generators independently', () => {
            fc.assert(
                fc.property(
                    fc.record({
                        nodeId: fc.string({ minLength: 1, maxLength: 10 }),
                        eventTypeToReset: fc.constantFrom('session-state', 'stage-snapshot', 'task-progress'),
                        otherEventTypes: fc.array(
                            fc.constantFrom('session-state', 'stage-snapshot', 'task-progress'),
                            { minLength: 1, maxLength: 2 }
                        ).map(types => Array.from(new Set(types))), // Remove duplicates
                        eventsBeforeReset: fc.integer({ min: 2, max: 5 }),
                        eventsAfterReset: fc.integer({ min: 1, max: 5 }),
                        workerIndex: fc.integer({ min: 0, max: MAX_WORKERS - 1 }),
                        totalWorkers: fc.integer({ min: 1, max: MAX_WORKERS }),
                    }),
                    ({ nodeId, eventTypeToReset, otherEventTypes, eventsBeforeReset, eventsAfterReset, workerIndex, totalWorkers }) => {
                        // Filter out the event type to reset from other types
                        const filteredOtherTypes = otherEventTypes.filter(type => type !== eventTypeToReset);
                        if (filteredOtherTypes.length === 0) return; // Skip if no other types
                        
                        // Ensure workerIndex is valid for totalWorkers
                        const validWorkerIndex = workerIndex % totalWorkers;
                        
                        const node = createNodeId(nodeId);
                        const allEventTypes = [eventTypeToReset, ...filteredOtherTypes];
                        
                        // Initialize all generators and generate some seqNums
                        allEventTypes.forEach(eventType => {
                            generator.initializeGenerator(node, eventType, validWorkerIndex, totalWorkers);
                            
                            for (let i = 0; i < eventsBeforeReset; i++) {
                                generator.nextSeqNum(node, eventType);
                            }
                        });
                        
                        // Get the last seqNum for other event types before reset
                        const lastSeqNumsBeforeReset: Record<string, number> = {};
                        filteredOtherTypes.forEach(eventType => {
                            // Generate one more to get current state
                            lastSeqNumsBeforeReset[eventType] = generator.nextSeqNum(node, eventType);
                        });
                        
                        // Reset only the specific event type
                        generator.resetGenerator(node, eventTypeToReset);
                        
                        // Re-initialize the reset event type
                        generator.initializeGenerator(node, eventTypeToReset, validWorkerIndex, totalWorkers);
                        
                        // Generate seqNums after reset for the reset event type
                        const resetEventSeqNums: number[] = [];
                        for (let i = 0; i < eventsAfterReset; i++) {
                            resetEventSeqNums.push(generator.nextSeqNum(node, eventTypeToReset));
                        }
                        
                        // Generate seqNums for other event types to verify they weren't affected
                        const firstSeqNumsAfterReset: Record<string, number> = {};
                        filteredOtherTypes.forEach(eventType => {
                            firstSeqNumsAfterReset[eventType] = generator.nextSeqNum(node, eventType);
                        });
                        
                        // Verify reset event type starts from workerIndex and follows pattern
                        expect(resetEventSeqNums[0]).toBe(validWorkerIndex);
                        if (eventsAfterReset > 1) {
                            expect(resetEventSeqNums[1]).toBe(validWorkerIndex + totalWorkers);
                        }
                        
                        // Verify other event types continue from where they left off
                        filteredOtherTypes.forEach(eventType => {
                            const expectedNextSeqNum = lastSeqNumsBeforeReset[eventType]! + totalWorkers;
                            expect(firstSeqNumsAfterReset[eventType]).toBe(expectedNextSeqNum);
                        });
                    }
                ),
                { numRuns: PROPERTY_TEST_RUNS }
            );
        });
    });

    describe('UnconditionalEventStreamer Integration', () => {
        it('should integrate seqNum generation with event streaming', () => {
            fc.assert(
                fc.property(
                    fc.record({
                        nodeId: fc.string({ minLength: 1, maxLength: 10 }),
                        eventType: fc.constantFrom('session-state', 'stage-snapshot', 'task-progress'),
                        eventCount: fc.integer({ min: 1, max: 10 }),
                        workerIndex: fc.integer({ min: 0, max: MAX_WORKERS - 1 }),
                        totalWorkers: fc.integer({ min: 1, max: MAX_WORKERS }),
                    }),
                    ({ nodeId, eventType, eventCount, workerIndex, totalWorkers }) => {
                        // Ensure workerIndex is valid for totalWorkers
                        const validWorkerIndex = workerIndex % totalWorkers;
                        
                        const node = createNodeId(nodeId);
                        const receivedEvents: any[] = [];
                        
                        // Configure distributed sequence numbering
                        unconditionalEventStreamer.configureDistributedSeqNum(node, validWorkerIndex, totalWorkers);
                        
                        // Subscribe to events
                        const unsubscribe = unconditionalEventStreamer.subscribe(
                            node,
                            eventType,
                            (event) => receivedEvents.push(event)
                        );
                        
                        // Emit events
                        for (let i = 0; i < eventCount; i++) {
                            unconditionalEventStreamer.emitEvent(
                                node,
                                eventType as 'session-state' | 'stage-snapshot' | 'task-progress',
                                { eventIndex: i } as any
                            );
                        }
                        
                        // Verify all events were received
                        expect(receivedEvents.length).toBe(eventCount);
                        
                        // Verify seqNum generation follows distributed pattern
                        receivedEvents.forEach((event, index) => {
                            const expectedSeqNum = validWorkerIndex + (index * totalWorkers);
                            expect(event.seqNum).toBe(expectedSeqNum);
                        });
                        
                        // Verify monotonicity
                        for (let i = 1; i < receivedEvents.length; i++) {
                            expect(receivedEvents[i].seqNum).toBeGreaterThan(receivedEvents[i - 1].seqNum);
                        }
                        
                        // Cleanup
                        unsubscribe();
                        unconditionalEventStreamer.cleanup(node);
                    }
                ),
                { numRuns: PROPERTY_TEST_RUNS }
            );
        });
    });
});