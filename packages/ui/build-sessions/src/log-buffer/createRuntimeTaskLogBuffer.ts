export type RuntimeTaskLogStream = 'stdout' | 'stderr' | 'system';

export type RuntimeTaskLogRow =
  | {
      readonly kind: 'log';
      readonly rowId: string;
      readonly taskId: string;
      readonly connectionEpoch: number;
      readonly ordinal: number;
      readonly sequence: number;
      readonly timestamp: string;
      readonly stream: RuntimeTaskLogStream;
      readonly text: string;
    }
  | {
      readonly kind: 'gap';
      readonly rowId: string;
      readonly taskId: string;
      readonly connectionEpoch: number;
      readonly ordinal: number;
      readonly reason: 'reconnected';
    }
  | {
      readonly kind: 'limit';
      readonly rowId: string;
      readonly taskId: string;
      readonly connectionEpoch: number;
      readonly ordinal: number;
      readonly reason: 'LOG_BUFFER_LIMIT_REACHED';
    };

export type RuntimeTaskLogPublicSnapshot = {
  readonly taskId: string;
  readonly connectionEpoch: number;
  readonly rowCount: number;
  readonly limitReached: boolean;
  readonly byteCount: number;
};

export type RuntimeTaskLogBufferConfig = {
  readonly taskId: string;
  readonly maxRows: number;
  readonly maxBytes: number;
};

export type RuntimeTaskLogAppendInput = {
  readonly sequence: number;
  readonly timestamp: string;
  readonly stream: RuntimeTaskLogStream;
  readonly text: string;
};

const textEncoder = new TextEncoder();

const assertPositiveInteger = (value: number, label: string): number => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`[runtimeTaskLogBuffer] ${label} must be a positive integer`);
  }
  return value;
};

const assertNonNegativeInteger = (value: number, label: string): number => {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`[runtimeTaskLogBuffer] ${label} must be a non-negative integer`);
  }
  return value;
};

const assertNonEmptyString = (value: string, label: string): string => {
  if (value.length === 0) {
    throw new Error(`[runtimeTaskLogBuffer] ${label} must be a non-empty string`);
  }
  return value;
};

const byteLength = (value: string): number => textEncoder.encode(value).byteLength;

export class RuntimeTaskLogBuffer {
  private readonly taskId: string;
  private readonly maxRows: number;
  private readonly maxBytes: number;
  private rows: RuntimeTaskLogRow[] = [];
  private connectionEpoch = 0;
  private nextOrdinal = 0;
  private capturedBytes = 0;
  private limitReached = false;

  constructor(config: RuntimeTaskLogBufferConfig) {
    this.taskId = assertNonEmptyString(config.taskId, 'taskId');
    this.maxRows = assertPositiveInteger(config.maxRows, 'maxRows');
    this.maxBytes = assertPositiveInteger(config.maxBytes, 'maxBytes');
  }

  appendLog(input: RuntimeTaskLogAppendInput): RuntimeTaskLogRow | null {
    if (this.limitReached) return null;
    assertNonNegativeInteger(input.sequence, 'sequence');
    assertNonEmptyString(input.timestamp, 'timestamp');
    const nextBytes = byteLength(input.text);
    if (this.rows.length + 1 > this.maxRows || this.capturedBytes + nextBytes > this.maxBytes) {
      return this.appendLimitMarker();
    }
    const row = this.createRow({
      kind: 'log',
      sequence: input.sequence,
      timestamp: input.timestamp,
      stream: input.stream,
      text: input.text,
    });
    this.rows = [...this.rows, row];
    this.capturedBytes += nextBytes;
    return row;
  }

  markReconnected(): RuntimeTaskLogRow {
    this.connectionEpoch += 1;
    const row = this.createRow({
      kind: 'gap',
      reason: 'reconnected',
    });
    this.rows = [...this.rows, row];
    return row;
  }

  snapshot(): readonly RuntimeTaskLogRow[] {
    return this.rows;
  }

  publicSnapshot(): RuntimeTaskLogPublicSnapshot {
    return {
      taskId: this.taskId,
      connectionEpoch: this.connectionEpoch,
      rowCount: this.rows.length,
      limitReached: this.limitReached,
      byteCount: this.capturedBytes,
    };
  }

  private appendLimitMarker(): RuntimeTaskLogRow {
    this.limitReached = true;
    const row = this.createRow({
      kind: 'limit',
      reason: 'LOG_BUFFER_LIMIT_REACHED',
    });
    this.rows = [...this.rows, row];
    return row;
  }

  private createRow(
    row:
      | Omit<
          Extract<RuntimeTaskLogRow, { kind: 'log' }>,
          'rowId' | 'taskId' | 'connectionEpoch' | 'ordinal'
        >
      | Omit<
          Extract<RuntimeTaskLogRow, { kind: 'gap' }>,
          'rowId' | 'taskId' | 'connectionEpoch' | 'ordinal'
        >
      | Omit<
          Extract<RuntimeTaskLogRow, { kind: 'limit' }>,
          'rowId' | 'taskId' | 'connectionEpoch' | 'ordinal'
        >
  ): RuntimeTaskLogRow {
    const ordinal = this.nextOrdinal;
    this.nextOrdinal += 1;
    return {
      ...row,
      rowId: `${this.taskId}:${this.connectionEpoch}:${ordinal}`,
      taskId: this.taskId,
      connectionEpoch: this.connectionEpoch,
      ordinal,
    } as RuntimeTaskLogRow;
  }
}
