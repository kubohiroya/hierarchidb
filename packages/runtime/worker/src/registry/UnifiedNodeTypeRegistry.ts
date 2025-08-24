/**
 * @file UnifiedNodeTypeRegistry.ts
 * @deprecated Use NodeRegistry instead. This file will be removed in v2.0.
 */

import { NodeRegistry, type INodeRegistry } from './NodeRegistry';

/**
 * @deprecated Use INodeRegistry instead. Will be removed in v2.0.
 */
export type IUnifiedNodeTypeRegistry = INodeRegistry;

/**
 * @deprecated Use NodeRegistry instead. Will be removed in v2.0.
 */
export const UnifiedNodeTypeRegistry = NodeRegistry;