import { proxy } from 'comlink';

export type CommandHandler = (...args: any[]) => any;
export type CommandMap = Record<string, CommandHandler>;

export type CommandInvoker<TMap extends CommandMap> = (
  command: keyof TMap & string,
  ...args: any[]
) => any;

export type RemoteCommandInvoker<TMap extends CommandMap> = CommandInvoker<TMap>;

export interface CommandTransformerOptions<TRuntimeMap extends CommandMap, TUiMap extends CommandMap, TWorkerMap extends CommandMap> {
  runtimeToUi?: (
    command: keyof TRuntimeMap & string,
    args: any[]
  ) => { command: keyof TUiMap & string; args: any[] };
  workerToRuntime?: (
    command: keyof TWorkerMap & string,
    args: any[]
  ) => { command: keyof TRuntimeMap & string; args: any[] };
}

export interface ComlinkCommandBridge<TRuntimeMap extends CommandMap, TUiMap extends CommandMap, TWorkerMap extends CommandMap> {
  createUiInvoker(invoker: CommandInvoker<TUiMap>): RemoteCommandInvoker<TRuntimeMap>;
  toRuntimeInvoker(invoker: RemoteCommandInvoker<TRuntimeMap>): CommandInvoker<TWorkerMap>;
}

export function createComlinkCommandBridge<
  TRuntimeMap extends CommandMap,
  TUiMap extends CommandMap = TRuntimeMap,
  TWorkerMap extends CommandMap = TRuntimeMap
>(options: CommandTransformerOptions<TRuntimeMap, TUiMap, TWorkerMap> = {}): ComlinkCommandBridge<TRuntimeMap, TUiMap, TWorkerMap> {
  const { runtimeToUi, workerToRuntime } = options;

  return {
    createUiInvoker(invoker: CommandInvoker<TUiMap>): RemoteCommandInvoker<TRuntimeMap> {
      return proxy((command: keyof TRuntimeMap & string, ...args: any[]) => {
        if (runtimeToUi) {
          const transformed = runtimeToUi(command, args);
          return invoker(transformed.command, ...transformed.args);
        }
        return invoker(command as unknown as keyof TUiMap & string, ...args);
      }) as RemoteCommandInvoker<TRuntimeMap>;
    },
    toRuntimeInvoker(invoker: RemoteCommandInvoker<TRuntimeMap>): CommandInvoker<TWorkerMap> {
      return ((command: keyof TWorkerMap & string, ...args: any[]) => {
        if (workerToRuntime) {
          const transformed = workerToRuntime(command, args);
          return invoker(transformed.command, ...transformed.args);
        }
        return invoker(command as unknown as keyof TRuntimeMap & string, ...args);
      }) as CommandInvoker<TWorkerMap>;
    },
  };
}
