/**
 * Command Builder Utility
 * 
 * Provides standardized command creation for the command pattern
 * used throughout the application.
 */

// No specific CommandKind type in core - using string

export interface CommandOptions {
  groupId?: string;
  metadata?: Record<string, any>;
}

/**
 * Creates a standardized command object with consistent IDs and timestamps
 * 
 * @param action - The action type for the command
 * @param payload - The command payload
 * @param options - Optional configuration for the command
 * @returns A standardized command object
 * 
 * @example
 * ```typescript
 * const deleteCommand = createCommand('delete', { nodeIds: ['1', '2'] });
 * const importCommand = createCommand('import-template', { templateId: 'population-2023' });
 * ```
 */
export function createCommand<T = any>(
  action: string,
  payload: T,
  options: CommandOptions = {}
) {
  const timestamp = Date.now();
  const { groupId, metadata } = options;
  
  return {
    commandId: `${action}-${timestamp}`,
    groupId: groupId || `group-${timestamp}`,
    kind: action,
    payload,
    issuedAt: timestamp,
    ...(metadata && { metadata }),
  };
}

/**
 * Creates a batch command for multiple operations
 * 
 * @param action - The action type for the command
 * @param items - Array of items to process
 * @param payloadTransform - Function to transform each item into a payload
 * @returns A batch command object
 */
export function createBatchCommand<T, P = any>(
  action: string,
  items: T[],
  payloadTransform: (item: T) => P
) {
  const timestamp = Date.now();
  const groupId = `batch-${timestamp}`;
  
  return items.map((item, index) => ({
    commandId: `${action}-${timestamp}-${index}`,
    groupId,
    kind: action,
    payload: payloadTransform(item),
    issuedAt: timestamp + index,
  }));
}

/**
 * Command action type constants
 */
export const CommandActions = {
  // Node operations
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  MOVE: 'move',
  COPY: 'copy',
  DUPLICATE: 'duplicate',
  
  // Trash operations
  TRASH: 'trash',
  RECOVER: 'recover',
  EMPTY_TRASH: 'empty-trash',
  
  // Import/Export operations
  IMPORT: 'import',
  IMPORT_TEMPLATE: 'import-template',
  EXPORT: 'export',
  
  // Working copy operations
  CREATE_WORKING_COPY: 'create-working-copy',
  UPDATE_WORKING_COPY: 'update-working-copy',
  COMMIT_WORKING_COPY: 'commit-working-copy',
  DISCARD_WORKING_COPY: 'discard-working-copy',
} as const;

export type CommandAction = typeof CommandActions[keyof typeof CommandActions];