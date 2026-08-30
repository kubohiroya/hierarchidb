import { describe, expect, it } from 'vitest';
import { RuntimeTaskLogBuffer } from '../createRuntimeTaskLogBuffer.js';

const createBuffer = (maxRows = 10, maxBytes = 1024): RuntimeTaskLogBuffer =>
  new RuntimeTaskLogBuffer({ taskId: 'task-1', maxRows, maxBytes });

describe('RuntimeTaskLogBuffer', () => {
  it('assigns stable runtime row identity from task, connection epoch, and ordinal', () => {
    const buffer = createBuffer();

    buffer.appendLog({
      sequence: 0,
      timestamp: '2026-08-30T00:00:00Z',
      stream: 'stdout',
      text: 'first',
    });
    buffer.markReconnected();
    buffer.appendLog({
      sequence: 1,
      timestamp: '2026-08-30T00:00:01Z',
      stream: 'stderr',
      text: 'second',
    });

    expect(buffer.snapshot().map((row) => row.rowId)).toEqual([
      'task-1:0:0',
      'task-1:1:1',
      'task-1:1:2',
    ]);
    expect(buffer.snapshot()[1]).toMatchObject({ kind: 'gap', reason: 'reconnected' });
  });

  it('does not evict existing rows after row limit is reached', () => {
    const buffer = createBuffer(2);

    buffer.appendLog({
      sequence: 0,
      timestamp: '2026-08-30T00:00:00Z',
      stream: 'stdout',
      text: 'first',
    });
    buffer.appendLog({
      sequence: 1,
      timestamp: '2026-08-30T00:00:01Z',
      stream: 'stdout',
      text: 'second',
    });
    buffer.appendLog({
      sequence: 2,
      timestamp: '2026-08-30T00:00:02Z',
      stream: 'stdout',
      text: 'third',
    });

    expect(buffer.snapshot()).toHaveLength(3);
    expect(buffer.snapshot().map((row) => row.kind)).toEqual(['log', 'log', 'limit']);
    expect(
      buffer.appendLog({
        sequence: 3,
        timestamp: '2026-08-30T00:00:03Z',
        stream: 'stdout',
        text: 'fourth',
      })
    ).toBeNull();
    expect(buffer.snapshot()).toHaveLength(3);
  });

  it('does not expose raw log text through the public snapshot', () => {
    const buffer = createBuffer();
    buffer.appendLog({
      sequence: 0,
      timestamp: '2026-08-30T00:00:00Z',
      stream: 'stdout',
      text: 'secret log body',
    });

    const publicSnapshot = buffer.publicSnapshot();

    expect(publicSnapshot).toEqual({
      taskId: 'task-1',
      connectionEpoch: 0,
      rowCount: 1,
      limitReached: false,
      byteCount: 15,
    });
    expect(JSON.stringify(publicSnapshot)).not.toContain('secret log body');
  });
});
