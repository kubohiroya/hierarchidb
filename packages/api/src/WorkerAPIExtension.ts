import type {
  TreeNodeType,
  APIMethodArgs,
  APIMethodReturn,
  WorkerAPIMethod,
} from '@hierarchidb/core';

// Worker API拡張の型定義
export interface WorkerAPIExtension<
  TMethods extends Record<string, WorkerAPIMethod> = Record<string, WorkerAPIMethod>,
> {
  readonly nodeType: TreeNodeType;
  readonly methods: TMethods;
}

// 型安全なメソッド呼び出し結果
export type InvokeResult<
  T extends WorkerAPIExtension,
  M extends keyof T['methods'],
> = T['methods'][M] extends (...args: APIMethodArgs) => Promise<infer R>
  ? R extends APIMethodReturn
    ? R
    : never
  : never;

export class WorkerAPIRegistry {
  private extensions: Map<TreeNodeType, WorkerAPIExtension<Record<string, WorkerAPIMethod>>> =
    new Map();

  register<T extends Record<string, WorkerAPIMethod>>(extension: WorkerAPIExtension<T>): void {
    this.extensions.set(extension.nodeType, extension);
  }

  unregister(nodeType: TreeNodeType): void {
    this.extensions.delete(nodeType);
  }

  getExtension<T extends Record<string, WorkerAPIMethod> = Record<string, WorkerAPIMethod>>(
    nodeType: TreeNodeType
  ): WorkerAPIExtension<T> | undefined {
    return this.extensions.get(nodeType) as WorkerAPIExtension<T> | undefined;
  }

  async invokeMethod<
    TMethods extends Record<string, WorkerAPIMethod>,
    TMethod extends keyof TMethods,
    TArgs extends Parameters<TMethods[TMethod]>,
    TReturn extends ReturnType<TMethods[TMethod]>,
  >(nodeType: TreeNodeType, methodName: TMethod, ...args: TArgs): Promise<TReturn> {
    const extension = this.getExtension<TMethods>(nodeType);
    if (!extension || !extension.methods[methodName]) {
      throw new Error(`Method ${String(methodName)} not found for ${nodeType}`);
    }

    return (await (extension.methods[methodName] as WorkerAPIMethod<TArgs>)(...args)) as TReturn;
  }

  hasMethod(nodeType: TreeNodeType, methodName: string): boolean {
    const extension = this.getExtension(nodeType);
    return !!extension?.methods[methodName];
  }

  getAvailableMethods(nodeType: TreeNodeType): string[] {
    const extension = this.getExtension(nodeType);
    return extension ? Object.keys(extension.methods) : [];
  }

  getAllExtensions(): Array<WorkerAPIExtension<Record<string, WorkerAPIMethod>>> {
    return Array.from(this.extensions.values());
  }
}
