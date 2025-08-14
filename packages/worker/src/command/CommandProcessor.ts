import type { UUID, Timestamp, Seq } from '@hierarchidb/core';
import { generateUUID } from '@hierarchidb/core';
import type { CommandEnvelope, CommandMeta, CommandResult, CommandEvent } from './types';
import { WorkerErrorCode } from './types';

/**
 * Command processor for handling command execution and undo/redo
 */
export class CommandProcessor {
  private undoStack: CommandEnvelope<any, any>[] = [];
  private redoStack: CommandEnvelope<any, any>[] = [];
  private eventHistory: CommandEvent[] = [];
  private sequenceNumber: number = 0;

  /**
   * Create a command envelope with auto-generated metadata
   */
  createEnvelope<TType extends string, TPayload>(
    type: TType,
    payload: TPayload,
    meta?: Partial<CommandMeta>
  ): CommandEnvelope<TType, TPayload> {
    const commandId = meta?.commandId ?? generateUUID();
    const timestamp = meta?.timestamp ?? (Date.now() as Timestamp);

    return {
      commandId,
      groupId: generateUUID(), // Auto-generate group ID
      kind: type,
      payload,
      issuedAt: timestamp,
      type, // Backward compatibility alias
      meta: {
        commandId,
        timestamp,
        userId: meta?.userId,
        correlationId: meta?.correlationId,
      },
    };
  }

  /**
   * Process a command and return the result
   */
  async processCommand<TType extends string, TPayload>(
    envelope: CommandEnvelope<TType, TPayload>
  ): Promise<CommandResult> {
    try {
      // Validate command
      if (!this.isValidCommand(envelope.kind)) {
        return this.createErrorResult('Invalid command type', WorkerErrorCode.INVALID_OPERATION);
      }

      // Execute command based on type
      const result = await this.executeCommand(envelope);

      // Record in undo buffer if successful and undoable
      if (result.success && this.isUndoableCommand(envelope.kind)) {
        this.undoStack.push(envelope);
        this.redoStack = []; // Clear redo stack on new command
      }

      // Track event
      this.recordEvent(envelope, result);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return this.createErrorResult(errorMessage, WorkerErrorCode.INVALID_OPERATION);
    }
  }

  /**
   * Execute the actual command logic
   */
  private async executeCommand<TType extends string, TPayload>(
    envelope: CommandEnvelope<TType, TPayload>
  ): Promise<CommandResult> {
    // Simulate command execution
    // In real implementation, this would delegate to specific command handlers

    switch (envelope.kind) {
      case 'createNode':
      case 'updateNode':
        return {
          success: true,
          seq: this.getNextSeq(),
          nodeId: 'node-123' as any, // Mock node ID
        };

      case 'ping':
      case 'test':
      case 'bulkCreate':
        return {
          success: true,
          seq: this.getNextSeq(),
        };

      case 'invalidCommand':
        return this.createErrorResult('Command not supported', WorkerErrorCode.INVALID_OPERATION);

      default:
        return {
          success: true,
          seq: this.getNextSeq(),
        };
    }
  }

  /**
   * Check if command type is valid
   */
  private isValidCommand(type: string): boolean {
    // In real implementation, this would check against registered command types
    return type !== 'invalidCommand';
  }

  /**
   * Check if command is undoable
   */
  private isUndoableCommand(type: string): boolean {
    // Commands that modify state are undoable
    const undoableCommands = ['createNode', 'updateNode', 'deleteNode', 'moveNode'];
    return undoableCommands.includes(type);
  }

  /**
   * Get next sequence number
   */
  private getNextSeq(): Seq {
    return ++this.sequenceNumber as Seq;
  }

  /**
   * Create error result
   */
  private createErrorResult(error: string, code: WorkerErrorCode): CommandResult {
    return {
      success: false,
      error,
      code,
      seq: this.getNextSeq(),
    };
  }

  /**
   * Record command event
   */
  private recordEvent<TType extends string, TPayload>(
    envelope: CommandEnvelope<TType, TPayload>,
    result: CommandResult
  ): void {
    const event: CommandEvent = {
      commandId: envelope.commandId,
      timestamp: envelope.issuedAt,
      correlationId: envelope.meta?.correlationId,
      result,
    };

    this.eventHistory.push(event);

    // Keep only last 1000 events
    if (this.eventHistory.length > 1000) {
      this.eventHistory = this.eventHistory.slice(-1000);
    }
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Get undo stack size
   */
  getUndoStackSize(): number {
    return this.undoStack.length;
  }

  /**
   * Get redo stack size
   */
  getRedoStackSize(): number {
    return this.redoStack.length;
  }

  /**
   * Get last event
   */
  getLastEvent(): CommandEvent | undefined {
    return this.eventHistory[this.eventHistory.length - 1];
  }

  /**
   * Undo last command
   */
  async undo(): Promise<CommandResult> {
    const command = this.undoStack.pop();
    if (!command) {
      return this.createErrorResult('No command to undo', WorkerErrorCode.INVALID_OPERATION);
    }

    // In real implementation, this would reverse the command effect
    this.redoStack.push(command);

    return {
      success: true,
      seq: this.getNextSeq(),
    };
  }

  /**
   * Redo last undone command
   */
  async redo(): Promise<CommandResult> {
    const command = this.redoStack.pop();
    if (!command) {
      return this.createErrorResult('No command to redo', WorkerErrorCode.INVALID_OPERATION);
    }

    // Re-execute the command
    const result = await this.processCommand(command);

    return result;
  }

  /**
   * Clear all history
   */
  clearHistory(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.eventHistory = [];
  }
}
