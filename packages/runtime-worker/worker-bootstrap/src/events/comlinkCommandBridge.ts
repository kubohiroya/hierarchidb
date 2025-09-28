/**
 * Comlink Command Bridge Helpers
 *
 * Allows UI → runtime worker → stage worker command invocation to be written once
 * while preserving strong typing through generics. Each hop can translate
 * command payloads if必要.
 */

import { proxy, type ProxyMarked } from 'comlink';

export type CommandMap = Record<string, any>;

export type CommandInvoker<TCommands extends CommandMap> = <K extends keyof TCommands>(
  command: K,
  payload: TCommands[K],
) => Promise<void>;

export type RemoteCommandInvoker<TCommands extends CommandMap> = CommandInvoker<TCommands> & ProxyMarked;

export interface ComlinkCommandBridge<
  TUiCommandMap extends CommandMap,
  TRuntimeCommandMap extends CommandMap = TUiCommandMap,
  TWorkerCommandMap extends CommandMap = TRuntimeCommandMap,
> {
  /** Wrap a remote invoker (from runtime worker) so UI code can call it with UI-level payloads */
  createUiInvoker(remote: RemoteCommandInvoker<TRuntimeCommandMap>): CommandInvoker<TUiCommandMap>;
  /** Adapt a runtime invoker into a worker-facing invoker (bridge to grandchild worker) */
  toRuntimeInvoker(invoker: CommandInvoker<TRuntimeCommandMap>): CommandInvoker<TWorkerCommandMap>;
  /** Create a proxy invoker that can be sent over Comlink */
  createRemoteInvoker(invoker: CommandInvoker<TRuntimeCommandMap>): RemoteCommandInvoker<TRuntimeCommandMap>;
}

export interface CommandTransformerOptions<TRuntimeCommandMap extends CommandMap, TUiCommandMap extends CommandMap, TWorkerCommandMap extends CommandMap> {
  uiToRuntime?: <K extends keyof TUiCommandMap>(command: K, payload: TUiCommandMap[K]) => {
    command: keyof TRuntimeCommandMap;
    payload: TRuntimeCommandMap[keyof TRuntimeCommandMap];
  };
  runtimeToWorker?: <K extends keyof TRuntimeCommandMap>(command: K, payload: TRuntimeCommandMap[K]) => {
    command: keyof TWorkerCommandMap;
    payload: TWorkerCommandMap[keyof TWorkerCommandMap];
  };
}

export function createComlinkCommandBridge<
  TUiCommandMap extends CommandMap,
  TRuntimeCommandMap extends CommandMap = TUiCommandMap,
  TWorkerCommandMap extends CommandMap = TRuntimeCommandMap,
>(
  options: CommandTransformerOptions<TRuntimeCommandMap, TUiCommandMap, TWorkerCommandMap> = {},
): ComlinkCommandBridge<TUiCommandMap, TRuntimeCommandMap, TWorkerCommandMap> {
  const { uiToRuntime, runtimeToWorker } = options;

  const createUiInvoker = (remote: RemoteCommandInvoker<TRuntimeCommandMap>): CommandInvoker<TUiCommandMap> => {
    return async (command, payload) => {
      if (uiToRuntime) {
        const mapped = uiToRuntime(command, payload);
        return remote(
          mapped.command as keyof TRuntimeCommandMap,
          mapped.payload as unknown as TRuntimeCommandMap[keyof TRuntimeCommandMap],
        );
      }
      return remote(
        command as unknown as keyof TRuntimeCommandMap,
        payload as unknown as TRuntimeCommandMap[keyof TRuntimeCommandMap],
      );
    };
  };

  const toRuntimeInvoker = (invoker: CommandInvoker<TRuntimeCommandMap>): CommandInvoker<TWorkerCommandMap> => {
    return async (command, payload) => {
      if (runtimeToWorker) {
        const mapped = runtimeToWorker(
          command as keyof TRuntimeCommandMap,
          payload as unknown as TRuntimeCommandMap[keyof TRuntimeCommandMap],
        );
        return invoker(
          mapped.command as keyof TRuntimeCommandMap,
          mapped.payload as unknown as TRuntimeCommandMap[keyof TRuntimeCommandMap],
        );
      }
      return invoker(
        command as unknown as keyof TRuntimeCommandMap,
        payload as unknown as TRuntimeCommandMap[keyof TRuntimeCommandMap],
      );
    };
  };

  const createRemoteInvoker = (invoker: CommandInvoker<TRuntimeCommandMap>): RemoteCommandInvoker<TRuntimeCommandMap> => {
    return proxy(async (command: keyof TRuntimeCommandMap, payload: TRuntimeCommandMap[keyof TRuntimeCommandMap]) => {
      await invoker(command, payload);
    });
  };

  return {
    createUiInvoker,
    toRuntimeInvoker,
    createRemoteInvoker,
  };
}
