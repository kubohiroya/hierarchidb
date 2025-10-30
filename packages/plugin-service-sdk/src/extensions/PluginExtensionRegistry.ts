import type { NodeType, WorkerAPIMethod, APIMethodArgs } from '@hierarchidb/common-types';
import type { InvokeResult, PluginExtensionAPI } from '@hierarchidb/plugin-service-api';

/**
 * Runtime registry that keeps track of plugin API extensions and performs
 * normalized method dispatch. Lives in the SDK because it contains logic,
 * while the type surface is provided by @hierarchidb/plugin-service-api.
 */
export class PluginExtensionRegistry {
  private readonly extensions: Map<NodeType, PluginExtensionAPI<Record<string, WorkerAPIMethod>>> = new Map();

  private normalizeNodeType<T extends string>(nodeType: T): T {
    return (typeof nodeType === 'string' && nodeType.endsWith('-plugin')
      ? (nodeType.slice(0, -8) as T)
      : nodeType) as T;
  }

  register<T extends Record<string, WorkerAPIMethod>>(extension: PluginExtensionAPI<T>): void {
    const key = this.normalizeNodeType(extension.nodeType);
    this.extensions.set(key, extension);
  }

  unregister(nodeType: NodeType): void {
    const key = this.normalizeNodeType(nodeType);
    this.extensions.delete(key);
  }

  getExtension<T extends Record<string, WorkerAPIMethod> = Record<string, WorkerAPIMethod>>(
    nodeType: NodeType,
  ): PluginExtensionAPI<T> | undefined {
    const key = this.normalizeNodeType(nodeType);
    return this.extensions.get(key) as PluginExtensionAPI<T> | undefined;
  }

  hasExtension(nodeType: NodeType): boolean {
    const key = this.normalizeNodeType(nodeType);
    return this.extensions.has(key);
  }

  hasMethod(nodeType: NodeType, method: string): boolean {
    const extension = this.getExtension(nodeType);
    return extension ? method in extension.methods : false;
  }

  async invokeMethod<
    TMethods extends Record<string, WorkerAPIMethod>,
    M extends keyof TMethods,
  >(nodeType: NodeType, method: M, ...args: APIMethodArgs): Promise<InvokeResult<PluginExtensionAPI<TMethods>, M>> {
    const extension = this.getExtension<TMethods>(nodeType);
    if (!extension) {
      throw new Error(`Plugin API not registered for node type: ${nodeType}`);
    }

    const handler = extension.methods[method];
    if (!handler) {
      throw new Error(`Method ${String(method)} not registered for node type: ${nodeType}`);
    }

    return (await handler(...args)) as InvokeResult<PluginExtensionAPI<TMethods>, M>;
  }

  listRegisteredNodeTypes(): NodeType[] {
    return Array.from(this.extensions.keys());
  }
}
