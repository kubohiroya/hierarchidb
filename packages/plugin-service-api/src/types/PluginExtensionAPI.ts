import type { APIMethodArgs, APIMethodReturn, NodeType, WorkerAPIMethod } from '@hierarchidb/common-types';

/**
 * Plugin API extension interface defining custom worker-facing methods.
 */
export interface PluginExtensionAPI<
  TMethods extends Record<string, WorkerAPIMethod> = Record<string, WorkerAPIMethod>,
> {
  readonly nodeType: NodeType;
  readonly methods: TMethods;
}

/**
 * Extract the resolved return type of a plugin extension method.
 */
export type InvokeResult<
  T extends PluginExtensionAPI,
  M extends keyof T['methods'],
> = T['methods'][M] extends (...args: APIMethodArgs) => Promise<infer R>
  ? R extends APIMethodReturn
    ? R
    : never
  : never;
