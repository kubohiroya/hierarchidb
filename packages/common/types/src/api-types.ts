// バリデーションルール

import { GroupEntity, PeerEntity, RelationalEntity } from './entity-types';
import { NodeId } from "./id-types";

// 共通のAPIメソッドの型
export type APIMethodArgs = readonly [NodeId, ...any[]];
export type APIMethodReturn =
  | PeerEntity
  | GroupEntity
  | RelationalEntity
  | PeerEntity[]
  | GroupEntity[]
  | RelationalEntity[]
  | string
  | number
  | boolean
  | void
  | { [key: string]: string | number | boolean };

// Worker API拡張メソッド
export type WorkerAPIMethod<
  TArgs extends APIMethodArgs = APIMethodArgs,
  TReturn extends APIMethodReturn = APIMethodReturn,
> = (...args: TArgs) => Promise<TReturn>;

export interface WorkerAPIExtensions {
  [methodName: string]: WorkerAPIMethod;
}

// 型安全なWorker API拡張
/**
 * @deprecated Unused across the repository; scheduled for removal.
 */
export interface TypedWorkerAPIExtensions<T extends Record<string, WorkerAPIMethod>> {
  methods: T;
}

// Client API拡張メソッド
/**
 * @deprecated Unused across the repository; scheduled for removal.
 */
export type ClientAPIMethod<
  TArgs extends APIMethodArgs = APIMethodArgs,
  TReturn extends APIMethodReturn = APIMethodReturn,
> = (...args: TArgs) => TReturn;

export interface ClientAPIExtensions {
  [methodName: string]: ClientAPIMethod;
}

// 型安全なClient API拡張
/**
 * @deprecated Unused across the repository; scheduled for removal.
 */
export interface TypedClientAPIExtensions<T extends Record<string, ClientAPIMethod>> {
  methods: T;
}
