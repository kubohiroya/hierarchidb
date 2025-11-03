import type { GroupEntity, PeerEntity, RelationalEntity } from './entity-types.js';
import type { NodeId } from './id-types.js';

//  API
export type APIMethodArgs = readonly [NodeId, ...unknown[]];
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
  | undefined
  | { [key: string]: string | number | boolean };

//  Worker API
export type WorkerAPIMethod<
  TArgs extends APIMethodArgs = APIMethodArgs,
  TReturn extends APIMethodReturn = APIMethodReturn,
> = (...args: TArgs) => Promise<TReturn>;

export interface WorkerAPIExtensions {
  [methodName: string]: WorkerAPIMethod;
}

//  Worker API
/**
 * @deprecated Unused across the repository; scheduled for removal.
 */
export interface TypedWorkerAPIExtensions<T extends Record<string, WorkerAPIMethod>> {
  methods: T;
}

//  Client API
/**
 * @deprecated Unused across the repository; scheduled for removal.
 */
export type ClientAPIMethod<
  TArgs extends APIMethodArgs = APIMethodArgs,
  TReturn extends APIMethodReturn = APIMethodReturn,
> = (...args: TArgs) => TReturn;

/*
export interface ClientAPIExtensions {
  [methodName: string]: ClientAPIMethod;
}

//  Client API

// @deprecated Unused across the repository; scheduled for removal.
export interface TypedClientAPIExtensions<T extends Record<string, ClientAPIMethod>> {
  methods: T;
}
*/
