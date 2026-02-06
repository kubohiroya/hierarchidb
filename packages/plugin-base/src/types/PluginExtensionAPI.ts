import type { NodeType } from '@hierarchidb/core-types';
import type { APIMethodArgs, APIMethodReturn, WorkerAPIMethod } from './api-types.js';

/**
 * Plugin API extension interface defining custom worker-facing methods.
 */
export interface PluginExtensionAPI<
  PeerEntity,
  TMethods extends Record<string, WorkerAPIMethod<PeerEntity>> = Record<string, WorkerAPIMethod<PeerEntity>>,
> {
  readonly nodeType: NodeType;
  readonly methods: TMethods;
}

/**
 * Extract the resolved return type of a plugin extension method.
 */
export type InvokeResult<
  PeerEntity,
  T extends PluginExtensionAPI<PeerEntity>,
  M extends keyof T['methods'],
> = T['methods'][M] extends (...args: APIMethodArgs) => Promise<infer R>
  ? R extends APIMethodReturn<PeerEntity>
    ? R
    : never
  : never;
