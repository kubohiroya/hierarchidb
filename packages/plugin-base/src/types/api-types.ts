import type { GroupEntity, RelationalEntity, NodeId } from '@hierarchidb/core-types';

//  API
export type APIMethodArgs = readonly [NodeId, ...unknown[]];
export type APIMethodReturn<T> =
  | GroupEntity
  | RelationalEntity<T>
  | GroupEntity[]
  | RelationalEntity<T>[]
  | string
  | number
  | boolean
  | undefined
  | { [key: string]: string | number | boolean };

//  Worker API
export type WorkerAPIMethod<
  T,
  TArgs extends APIMethodArgs = APIMethodArgs,
  TReturn extends APIMethodReturn<T> = APIMethodReturn<T>,
> = (...args: TArgs) => Promise<TReturn>;
