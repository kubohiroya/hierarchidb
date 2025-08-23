import type { Seq, Timestamp, NodeId, EntityId } from '@hierarchidb/00-core';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  type CommandEnvelope,
  CommandMeta,
  CommandProcessor,
  type CommandResult,
  WorkerErrorCode,
} from '../index';

// ユーティリティ関数のモック
const generateNodeId = (): string => `uuid-${Date.now()}-${Math.random()}` as string;

describe('Command Pattern Implementation', () => {
  describe('CommandEnvelope Structure', () => {
    it('should create a valid CommandEnvelope', () => {
      const commandId = generateNodeId();
      const timestamp = Date.now() as Timestamp;
      const envelope: CommandEnvelope<'testCommand', { data: string }> = {
        commandId,
        groupId: generateNodeId(),
        kind: 'testCommand',
        payload: { data: 'test' },
        issuedAt: timestamp,
        type: 'testCommand',
        meta: {
          commandId,
          timestamp,
          userId: 'user123',
        },
      };

      expect(envelope.kind).toBe('testCommand');
      expect(envelope.type).toBe('testCommand');
      expect(envelope.payload.data).toBe('test');
      expect(envelope.meta?.commandId).toBeDefined();
    });

    it('should auto-generate command meta if not provided', () => {
      const processor = new CommandProcessor();
      const envelope = processor.createEnvelope('testCommand', { data: 'test' });

      expect(envelope.meta?.commandId).toBeDefined();
      expect(envelope.meta?.timestamp).toBeCloseTo(Date.now(), -2);
    });
  });

  describe('CommandResult Union Type', () => {
    it('should create success result', () => {
      const result: CommandResult = {
        success: true,
        seq: 1 as Seq,
        nodeId: 'node-123' as NodeId,
      };

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.seq).toBe(1);
        expect(result.nodeId).toBe('node-123');
      }
    });

    it('should create failure result', () => {
      const result: CommandResult = {
        success: false,
        error: 'Node not found',
        code: WorkerErrorCode.NODE_NOT_FOUND,
      };

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Node not found');
        expect(result.code).toBe(WorkerErrorCode.NODE_NOT_FOUND);
      }
    });
  });

  describe('ErrorCode Enumeration', () => {
    it('should have all required error codes', () => {
      expect(WorkerErrorCode.UNKNOWN_ERROR).toBeDefined();
      expect(WorkerErrorCode.NODE_NOT_FOUND).toBeDefined();
      expect(WorkerErrorCode.WORKING_COPY_NOT_FOUND).toBeDefined();
      expect(WorkerErrorCode.COMMIT_CONFLICT).toBeDefined();
      expect(WorkerErrorCode.DATABASE_ERROR).toBeDefined();
    });
  });

  describe('CommandProcessor', () => {
    let processor: CommandProcessor;

    beforeEach(() => {
      processor = new CommandProcessor();
    });

    it('should process command successfully', async () => {
      const envelope = processor.createEnvelope('createNode', { name: 'New Node' });

      const result = await processor.processCommand(envelope);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.seq).toBeDefined();
      }
    });

    it('should handle errors properly', async () => {
      const envelope = processor.createEnvelope('invalidCommand', {});

      const result = await processor.processCommand(envelope);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(result.code).toBe(WorkerErrorCode.INVALID_OPERATION);
      }
    });

    it('should record command in undo buffer', async () => {
      const envelope = processor.createEnvelope('updateNode', { id: 'node-1', name: 'Updated' });

      await processor.processCommand(envelope);

      expect(processor.canUndo()).toBe(true);
      expect(processor.getUndoStackSize()).toBe(1);
    });
  });

  describe('Type Safety', () => {
    it('should infer types correctly', () => {
      const processor = new CommandProcessor();
      type TestPayload = { value: number };
      const envelope = processor.createEnvelope('test', { value: 42 } as TestPayload);

      expect(typeof envelope.payload.value).toBe('number');
    });
  });

  describe('Edge Cases', () => {
    let processor: CommandProcessor;

    beforeEach(() => {
      processor = new CommandProcessor();
    });

    it('should handle empty payload', async () => {
      const envelope = processor.createEnvelope('ping', {});

      const result = await processor.processCommand(envelope);
      expect(result).toBeDefined();
    });

    it('should handle large payload within performance limits', async () => {
      const largeData = Array(1000).fill({ data: 'test' });
      const envelope = processor.createEnvelope('bulkCreate', { items: largeData });

      const startTime = performance.now();
      const result = await processor.processCommand(envelope);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(100); // 100ms以内
    });

    it('should propagate correlationId', async () => {
      const correlationId = generateNodeId();
      const envelope = processor.createEnvelope('test', {}, { correlationId });

      await processor.processCommand(envelope);

      const lastEvent = processor.getLastEvent();
      expect(lastEvent?.correlationId).toBe(correlationId);
    });
  });
});
