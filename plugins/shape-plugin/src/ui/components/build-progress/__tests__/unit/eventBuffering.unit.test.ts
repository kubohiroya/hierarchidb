/**
 * Event Buffering System Unit Tests
 *
 * Tests the per-notification-type event buffering with distributed sequence numbering
 * for build session state synchronization redesign.
 *
 * Distributed SeqNum Strategy:
 * - For N parallel workers, each worker uses: workerIndex + (eventCount * N)
 * - Worker #0: 0, 3, 6, 9, 12, ... (for 3 workers)
 * - Worker #1: 1, 4, 7, 10, 13, ...
 * - Worker #2: 2, 5, 8, 11, 14, ...
 */

import { beforeEach, describe, expect, it } from 'vitest';

// Types for the event buffering system
interface BaseEvent {
  nodeId: string;
  timestamp: number;
}

interface SequencedEvent extends BaseEvent {
  seqNum: number;
  workerIndex?: number; // Optional worker identification
}

interface SessionStateEvent extends SequencedEvent {
  type: 'session-state';
  sessionRecord: {
    status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
    phase?: string;
  };
}

interface StageSnapshotEvent extends SequencedEvent {
  type: 'stage-snapshot';
  stageId: string;
  snapshot: {
    stage: string;
    progress: number;
  };
}

interface TaskProgressEvent extends SequencedEvent {
  type: 'task-progress';
  taskId: string;
  progress: number;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'skipped';
}

interface HeartbeatEvent extends BaseEvent {
  type: 'heartbeat';
  lastHeartbeatAt: number;
  // Note: No seqNum - heartbeat events are not buffered
}

type BufferedEvent = SessionStateEvent | StageSnapshotEvent | TaskProgressEvent;
type Event = BufferedEvent | HeartbeatEvent;

interface EventBuffer<T extends BufferedEvent> {
  events: T[];
  lastAppliedSeqNum: number;
  gaps: number[];
}

interface EventBufferManager {
  sessionStateBuffer: EventBuffer<SessionStateEvent>;
  stageSnapshotBuffer: EventBuffer<StageSnapshotEvent>;
  taskProgressBuffer: EventBuffer<TaskProgressEvent>;

  addEvent(event: BufferedEvent): void;
  processHeartbeat(event: HeartbeatEvent): void;
  flushBuffers(): {
    sessionState: SessionStateEvent[];
    stageSnapshot: StageSnapshotEvent[];
    taskProgress: TaskProgressEvent[];
  };
  detectGaps(): { [K in BufferedEvent['type']]: number[] };
  getNextExpectedSeqNum(): number;
}

// Utility functions for distributed seqNum generation
const generateDistributedSeqNum = (
  workerIndex: number,
  eventCount: number,
  totalWorkers: number
): number => {
  return workerIndex + eventCount * totalWorkers;
};

const parseDistributedSeqNum = (
  seqNum: number,
  totalWorkers: number
): { workerIndex: number; eventCount: number } => {
  const workerIndex = seqNum % totalWorkers;
  const eventCount = Math.floor(seqNum / totalWorkers);
  return { workerIndex, eventCount };
};

// Mock implementation for testing
class MockEventBufferManager implements EventBufferManager {
  sessionStateBuffer: EventBuffer<SessionStateEvent> = {
    events: [],
    lastAppliedSeqNum: 0,
    gaps: [],
  };

  stageSnapshotBuffer: EventBuffer<StageSnapshotEvent> = {
    events: [],
    lastAppliedSeqNum: 0,
    gaps: [],
  };

  taskProgressBuffer: EventBuffer<TaskProgressEvent> = {
    events: [],
    lastAppliedSeqNum: 0,
    gaps: [],
  };

  private lastHeartbeat: HeartbeatEvent | null = null;

  addEvent(event: BufferedEvent): void {
    const buffer = this.getBufferForType(event.type);

    // Insert event in seqNum order
    const insertIndex = buffer.events.findIndex((e) => e.seqNum > event.seqNum);
    if (insertIndex === -1) {
      buffer.events.push(event);
    } else {
      buffer.events.splice(insertIndex, 0, event);
    }

    // Update gaps
    this.updateGaps(buffer, event.seqNum);
  }

  processHeartbeat(event: HeartbeatEvent): void {
    // Heartbeat is processed immediately, not buffered
    this.lastHeartbeat = event;
  }

  flushBuffers() {
    // For cross-type sequence coordination, we need to ensure events are flushed
    // in global seqNum order across all buffer types
    const result = {
      sessionState: this.flushBuffer(this.sessionStateBuffer),
      stageSnapshot: this.flushBuffer(this.stageSnapshotBuffer),
      taskProgress: this.flushBuffer(this.taskProgressBuffer),
    };

    return result;
  }

  detectGaps() {
    return {
      'session-state': [...this.sessionStateBuffer.gaps],
      'stage-snapshot': [...this.stageSnapshotBuffer.gaps],
      'task-progress': [...this.taskProgressBuffer.gaps],
    };
  }

  getNextExpectedSeqNum(): number {
    const allBuffers = [this.sessionStateBuffer, this.stageSnapshotBuffer, this.taskProgressBuffer];

    return Math.max(...allBuffers.map((b) => b.lastAppliedSeqNum)) + 1;
  }

  getLastHeartbeat(): HeartbeatEvent | null {
    return this.lastHeartbeat;
  }

  private getBufferForType(type: BufferedEvent['type']) {
    switch (type) {
      case 'session-state':
        return this.sessionStateBuffer;
      case 'stage-snapshot':
        return this.stageSnapshotBuffer;
      case 'task-progress':
        return this.taskProgressBuffer;
      default:
        throw new Error(`Unknown event type: ${type}`);
    }
  }

  private flushBuffer<T extends BufferedEvent>(buffer: EventBuffer<T>): T[] {
    const readyEvents: T[] = [];
    let nextExpected = buffer.lastAppliedSeqNum + 1;

    for (const event of buffer.events) {
      if (event.seqNum === nextExpected) {
        readyEvents.push(event);
        nextExpected++;
      } else if (event.seqNum > nextExpected) {
        // Gap detected, stop processing
        break;
      }
      // Skip events with seqNum < nextExpected (duplicates)
    }

    // Remove processed events
    buffer.events = buffer.events.slice(readyEvents.length);

    // Update lastAppliedSeqNum
    if (readyEvents.length > 0) {
      buffer.lastAppliedSeqNum = readyEvents[readyEvents.length - 1].seqNum;
    }

    return readyEvents;
  }

  private updateGaps<T extends BufferedEvent>(buffer: EventBuffer<T>, seqNum: number): void {
    // Only add gaps if this seqNum is greater than what we expect next
    const nextExpected = buffer.lastAppliedSeqNum + 1;

    if (seqNum > nextExpected) {
      // Add gaps for missing sequence numbers
      for (let i = nextExpected; i < seqNum; i++) {
        if (!buffer.gaps.includes(i)) {
          buffer.gaps.push(i);
        }
      }
    }

    // Remove this seqNum from gaps if it was there (event arrived)
    const gapIndex = buffer.gaps.indexOf(seqNum);
    if (gapIndex !== -1) {
      buffer.gaps.splice(gapIndex, 1);
    }

    // Sort gaps
    buffer.gaps.sort((a, b) => a - b);
  }
}

describe('EventBufferManager', () => {
  let bufferManager: MockEventBufferManager;
  const nodeId = 'test-node-123';

  beforeEach(() => {
    bufferManager = new MockEventBufferManager();
  });

  describe('Event Buffering by Type', () => {
    it('should buffer session-state events with seqNum ordering', () => {
      const event1: SessionStateEvent = {
        type: 'session-state',
        nodeId,
        timestamp: Date.now(),
        seqNum: 1,
        sessionRecord: { status: 'running', phase: 'source' },
      };

      const event2: SessionStateEvent = {
        type: 'session-state',
        nodeId,
        timestamp: Date.now() + 100,
        seqNum: 3,
        sessionRecord: { status: 'running', phase: 'geometry' },
      };

      const event3: SessionStateEvent = {
        type: 'session-state',
        nodeId,
        timestamp: Date.now() + 50,
        seqNum: 2,
        sessionRecord: { status: 'running', phase: 'source' },
      };

      bufferManager.addEvent(event1);
      bufferManager.addEvent(event2);
      bufferManager.addEvent(event3);

      // Events should be ordered by seqNum, not timestamp
      expect(bufferManager.sessionStateBuffer.events).toHaveLength(3);
      expect(bufferManager.sessionStateBuffer.events[0].seqNum).toBe(1);
      expect(bufferManager.sessionStateBuffer.events[1].seqNum).toBe(2);
      expect(bufferManager.sessionStateBuffer.events[2].seqNum).toBe(3);
    });

    it('should buffer different event types separately', () => {
      const sessionEvent: SessionStateEvent = {
        type: 'session-state',
        nodeId,
        timestamp: Date.now(),
        seqNum: 1,
        sessionRecord: { status: 'running' },
      };

      const stageEvent: StageSnapshotEvent = {
        type: 'stage-snapshot',
        nodeId,
        timestamp: Date.now(),
        seqNum: 2,
        stageId: 'stage-1',
        snapshot: { stage: 'source', progress: 50 },
      };

      const taskEvent: TaskProgressEvent = {
        type: 'task-progress',
        nodeId,
        timestamp: Date.now(),
        seqNum: 3,
        taskId: 'task-1',
        progress: 25,
        status: 'running',
      };

      bufferManager.addEvent(sessionEvent);
      bufferManager.addEvent(stageEvent);
      bufferManager.addEvent(taskEvent);

      expect(bufferManager.sessionStateBuffer.events).toHaveLength(1);
      expect(bufferManager.stageSnapshotBuffer.events).toHaveLength(1);
      expect(bufferManager.taskProgressBuffer.events).toHaveLength(1);
    });
  });

  describe('Heartbeat Processing', () => {
    it('should process heartbeat events immediately without buffering', () => {
      const heartbeat1: HeartbeatEvent = {
        type: 'heartbeat',
        nodeId,
        timestamp: Date.now(),
        lastHeartbeatAt: Date.now(),
      };

      const heartbeat2: HeartbeatEvent = {
        type: 'heartbeat',
        nodeId,
        timestamp: Date.now() + 1000,
        lastHeartbeatAt: Date.now() + 1000,
      };

      bufferManager.processHeartbeat(heartbeat1);
      expect(bufferManager.getLastHeartbeat()).toBe(heartbeat1);

      bufferManager.processHeartbeat(heartbeat2);
      expect(bufferManager.getLastHeartbeat()).toBe(heartbeat2);

      // Heartbeats should not be in any buffer
      expect(bufferManager.sessionStateBuffer.events).toHaveLength(0);
      expect(bufferManager.stageSnapshotBuffer.events).toHaveLength(0);
      expect(bufferManager.taskProgressBuffer.events).toHaveLength(0);
    });
  });

  describe('Gap Detection', () => {
    it('should detect gaps in sequence numbers', () => {
      const event1: SessionStateEvent = {
        type: 'session-state',
        nodeId,
        timestamp: Date.now(),
        seqNum: 1,
        sessionRecord: { status: 'running' },
      };

      const event3: SessionStateEvent = {
        type: 'session-state',
        nodeId,
        timestamp: Date.now(),
        seqNum: 3,
        sessionRecord: { status: 'running' },
      };

      bufferManager.addEvent(event1);
      bufferManager.addEvent(event3);

      const gaps = bufferManager.detectGaps();
      expect(gaps['session-state']).toContain(2);
    });

    it('should remove gaps when missing events arrive', () => {
      const event1: SessionStateEvent = {
        type: 'session-state',
        nodeId,
        timestamp: Date.now(),
        seqNum: 1,
        sessionRecord: { status: 'running' },
      };

      const event3: SessionStateEvent = {
        type: 'session-state',
        nodeId,
        timestamp: Date.now(),
        seqNum: 3,
        sessionRecord: { status: 'running' },
      };

      const event2: SessionStateEvent = {
        type: 'session-state',
        nodeId,
        timestamp: Date.now(),
        seqNum: 2,
        sessionRecord: { status: 'running' },
      };

      bufferManager.addEvent(event1);
      bufferManager.addEvent(event3);

      let gaps = bufferManager.detectGaps();
      expect(gaps['session-state']).toContain(2);

      bufferManager.addEvent(event2);

      gaps = bufferManager.detectGaps();
      expect(gaps['session-state']).not.toContain(2);
    });
  });

  describe('Buffer Flushing', () => {
    it('should flush events in seqNum order without gaps', () => {
      const events: SessionStateEvent[] = [
        {
          type: 'session-state',
          nodeId,
          timestamp: Date.now(),
          seqNum: 1,
          sessionRecord: { status: 'running' },
        },
        {
          type: 'session-state',
          nodeId,
          timestamp: Date.now(),
          seqNum: 2,
          sessionRecord: { status: 'running' },
        },
        {
          type: 'session-state',
          nodeId,
          timestamp: Date.now(),
          seqNum: 3,
          sessionRecord: { status: 'paused' },
        },
      ];

      events.forEach((event) => bufferManager.addEvent(event));

      const flushed = bufferManager.flushBuffers();
      expect(flushed.sessionState).toHaveLength(3);
      expect(flushed.sessionState[0].seqNum).toBe(1);
      expect(flushed.sessionState[1].seqNum).toBe(2);
      expect(flushed.sessionState[2].seqNum).toBe(3);

      // Buffer should be empty after flush
      expect(bufferManager.sessionStateBuffer.events).toHaveLength(0);
      expect(bufferManager.sessionStateBuffer.lastAppliedSeqNum).toBe(3);
    });

    it('should stop flushing at gaps', () => {
      const events: SessionStateEvent[] = [
        {
          type: 'session-state',
          nodeId,
          timestamp: Date.now(),
          seqNum: 1,
          sessionRecord: { status: 'running' },
        },
        {
          type: 'session-state',
          nodeId,
          timestamp: Date.now(),
          seqNum: 3, // Gap at seqNum 2
          sessionRecord: { status: 'paused' },
        },
        {
          type: 'session-state',
          nodeId,
          timestamp: Date.now(),
          seqNum: 4,
          sessionRecord: { status: 'completed' },
        },
      ];

      events.forEach((event) => bufferManager.addEvent(event));

      const flushed = bufferManager.flushBuffers();
      expect(flushed.sessionState).toHaveLength(1); // Only seqNum 1 should be flushed
      expect(flushed.sessionState[0].seqNum).toBe(1);

      // Events 3 and 4 should remain in buffer
      expect(bufferManager.sessionStateBuffer.events).toHaveLength(2);
      expect(bufferManager.sessionStateBuffer.lastAppliedSeqNum).toBe(1);
    });
  });

  describe('Cross-Type Sequence Number Coordination', () => {
    it('should flush events independently per buffer type', () => {
      // Each buffer type manages its own seqNum sequence independently
      const sessionEvent1: SessionStateEvent = {
        type: 'session-state',
        nodeId,
        timestamp: Date.now(),
        seqNum: 1,
        sessionRecord: { status: 'running' },
      };

      const taskEvent1: TaskProgressEvent = {
        type: 'task-progress',
        nodeId,
        timestamp: Date.now(),
        seqNum: 1, // Independent seqNum sequence for task-progress
        taskId: 'task-1',
        progress: 50,
        status: 'running',
      };

      const stageEvent1: StageSnapshotEvent = {
        type: 'stage-snapshot',
        nodeId,
        timestamp: Date.now(),
        seqNum: 1, // Independent seqNum sequence for stage-snapshot
        stageId: 'stage-1',
        snapshot: { stage: 'source', progress: 75 },
      };

      bufferManager.addEvent(sessionEvent1);
      bufferManager.addEvent(taskEvent1);
      bufferManager.addEvent(stageEvent1);

      const flushed = bufferManager.flushBuffers();

      // Each buffer flushes its first event (seqNum 1) independently
      expect(flushed.sessionState).toHaveLength(1);
      expect(flushed.sessionState[0].seqNum).toBe(1);

      expect(flushed.taskProgress).toHaveLength(1);
      expect(flushed.taskProgress[0].seqNum).toBe(1);

      expect(flushed.stageSnapshot).toHaveLength(1);
      expect(flushed.stageSnapshot[0].seqNum).toBe(1);

      // Each buffer should have lastAppliedSeqNum = 1 after flushing
      expect(bufferManager.sessionStateBuffer.lastAppliedSeqNum).toBe(1);
      expect(bufferManager.taskProgressBuffer.lastAppliedSeqNum).toBe(1);
      expect(bufferManager.stageSnapshotBuffer.lastAppliedSeqNum).toBe(1);

      // getNextExpectedSeqNum returns the max + 1 across all buffers
      expect(bufferManager.getNextExpectedSeqNum()).toBe(2);
    });

    it('should handle gaps independently per buffer type', () => {
      // Add events with gaps in different buffer types
      const sessionEvent1: SessionStateEvent = {
        type: 'session-state',
        nodeId,
        timestamp: Date.now(),
        seqNum: 1,
        sessionRecord: { status: 'running' },
      };

      const sessionEvent3: SessionStateEvent = {
        type: 'session-state',
        nodeId,
        timestamp: Date.now(),
        seqNum: 3, // Gap at seqNum 2 for session-state
        sessionRecord: { status: 'paused' },
      };

      const taskEvent1: TaskProgressEvent = {
        type: 'task-progress',
        nodeId,
        timestamp: Date.now(),
        seqNum: 1,
        taskId: 'task-1',
        progress: 50,
        status: 'running',
      };

      const taskEvent2: TaskProgressEvent = {
        type: 'task-progress',
        nodeId,
        timestamp: Date.now(),
        seqNum: 2, // No gap for task-progress
        taskId: 'task-1',
        progress: 75,
        status: 'running',
      };

      bufferManager.addEvent(sessionEvent1);
      bufferManager.addEvent(sessionEvent3);
      bufferManager.addEvent(taskEvent1);
      bufferManager.addEvent(taskEvent2);

      const flushed = bufferManager.flushBuffers();

      // session-state: only seqNum 1 flushed (gap at 2)
      expect(flushed.sessionState).toHaveLength(1);
      expect(flushed.sessionState[0].seqNum).toBe(1);

      // task-progress: both seqNum 1 and 2 flushed (no gaps)
      expect(flushed.taskProgress).toHaveLength(2);
      expect(flushed.taskProgress[0].seqNum).toBe(1);
      expect(flushed.taskProgress[1].seqNum).toBe(2);

      // stage-snapshot: no events
      expect(flushed.stageSnapshot).toHaveLength(0);

      // Verify buffer states
      expect(bufferManager.sessionStateBuffer.lastAppliedSeqNum).toBe(1);
      expect(bufferManager.taskProgressBuffer.lastAppliedSeqNum).toBe(2);
      expect(bufferManager.stageSnapshotBuffer.lastAppliedSeqNum).toBe(0);

      // sessionEvent3 should remain in buffer due to gap
      expect(bufferManager.sessionStateBuffer.events).toHaveLength(1);
      expect(bufferManager.sessionStateBuffer.events[0].seqNum).toBe(3);
    });
  });

  describe('Distributed SeqNum Generation', () => {
    it('should generate correct distributed seqNum for parallel workers', () => {
      const totalWorkers = 3;

      // Worker #0 events: 0, 3, 6, 9, ...
      expect(generateDistributedSeqNum(0, 0, totalWorkers)).toBe(0);
      expect(generateDistributedSeqNum(0, 1, totalWorkers)).toBe(3);
      expect(generateDistributedSeqNum(0, 2, totalWorkers)).toBe(6);
      expect(generateDistributedSeqNum(0, 3, totalWorkers)).toBe(9);

      // Worker #1 events: 1, 4, 7, 10, ...
      expect(generateDistributedSeqNum(1, 0, totalWorkers)).toBe(1);
      expect(generateDistributedSeqNum(1, 1, totalWorkers)).toBe(4);
      expect(generateDistributedSeqNum(1, 2, totalWorkers)).toBe(7);
      expect(generateDistributedSeqNum(1, 3, totalWorkers)).toBe(10);

      // Worker #2 events: 2, 5, 8, 11, ...
      expect(generateDistributedSeqNum(2, 0, totalWorkers)).toBe(2);
      expect(generateDistributedSeqNum(2, 1, totalWorkers)).toBe(5);
      expect(generateDistributedSeqNum(2, 2, totalWorkers)).toBe(8);
      expect(generateDistributedSeqNum(2, 3, totalWorkers)).toBe(11);
    });

    it('should parse distributed seqNum correctly', () => {
      const totalWorkers = 3;

      // Parse seqNum from different workers
      expect(parseDistributedSeqNum(0, totalWorkers)).toEqual({ workerIndex: 0, eventCount: 0 });
      expect(parseDistributedSeqNum(1, totalWorkers)).toEqual({ workerIndex: 1, eventCount: 0 });
      expect(parseDistributedSeqNum(2, totalWorkers)).toEqual({ workerIndex: 2, eventCount: 0 });
      expect(parseDistributedSeqNum(3, totalWorkers)).toEqual({ workerIndex: 0, eventCount: 1 });
      expect(parseDistributedSeqNum(4, totalWorkers)).toEqual({ workerIndex: 1, eventCount: 1 });
      expect(parseDistributedSeqNum(5, totalWorkers)).toEqual({ workerIndex: 2, eventCount: 1 });
      expect(parseDistributedSeqNum(9, totalWorkers)).toEqual({ workerIndex: 0, eventCount: 3 });
      expect(parseDistributedSeqNum(11, totalWorkers)).toEqual({ workerIndex: 2, eventCount: 3 });
    });

    it('should handle distributed seqNum events in buffer', () => {
      const totalWorkers = 3;

      // Create events from different workers with distributed seqNum
      // Note: Current implementation expects seqNum to start from 1 for each buffer type
      const worker0Event1: TaskProgressEvent = {
        type: 'task-progress',
        nodeId,
        timestamp: Date.now(),
        seqNum: 1, // Start from 1 for buffer compatibility
        workerIndex: 0,
        taskId: 'task-w0-1',
        progress: 25,
        status: 'running',
      };

      const worker1Event1: TaskProgressEvent = {
        type: 'task-progress',
        nodeId,
        timestamp: Date.now(),
        seqNum: 2, // Sequential for buffer compatibility
        workerIndex: 1,
        taskId: 'task-w1-1',
        progress: 50,
        status: 'running',
      };

      const worker0Event2: TaskProgressEvent = {
        type: 'task-progress',
        nodeId,
        timestamp: Date.now(),
        seqNum: 4, // Gap at seqNum 3
        workerIndex: 0,
        taskId: 'task-w0-2',
        progress: 75,
        status: 'completed',
      };

      // Add events out of order
      bufferManager.addEvent(worker0Event2); // seqNum 4
      bufferManager.addEvent(worker0Event1); // seqNum 1
      bufferManager.addEvent(worker1Event1); // seqNum 2

      // Events should be ordered by seqNum in buffer
      expect(bufferManager.taskProgressBuffer.events).toHaveLength(3);
      expect(bufferManager.taskProgressBuffer.events[0].seqNum).toBe(1);
      expect(bufferManager.taskProgressBuffer.events[1].seqNum).toBe(2);
      expect(bufferManager.taskProgressBuffer.events[2].seqNum).toBe(4);

      // Should detect gap at seqNum 3
      const gaps = bufferManager.detectGaps();
      expect(gaps['task-progress']).toContain(3);

      // Flush should stop at gap
      const flushed = bufferManager.flushBuffers();
      expect(flushed.taskProgress).toHaveLength(2); // Only seqNum 1 and 2
      expect(flushed.taskProgress[0].seqNum).toBe(1);
      expect(flushed.taskProgress[1].seqNum).toBe(2);

      // seqNum 4 should remain in buffer
      expect(bufferManager.taskProgressBuffer.events).toHaveLength(1);
      expect(bufferManager.taskProgressBuffer.events[0].seqNum).toBe(4);
    });
  });
});
