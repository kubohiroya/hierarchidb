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
