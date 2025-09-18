import { RouteBatchManager } from './RouteBatchManager.js';
import { OsrmEngine } from './engines/OsrmEngine.js';
import { SearouteEngine } from './engines/SearouteEngine.js';
import { type NetworkPortLike as NetLike, ThrottledPort, type ThrottleOptions } from './net/ThrottledPort.js';

export interface NetworkPortLike extends NetLike {
}

export function createRouteBatchManager(deps?: {
  net?: NetworkPortLike;
  emitter?: any;
  store?: any;
  osrmThrottle?: ThrottleOptions
}) {
  const osrmPort = deps?.net ? (deps?.osrmThrottle ? new ThrottledPort(deps.net, deps.osrmThrottle) : deps.net) : undefined;
  const engines = osrmPort
    ? { osrm: new OsrmEngine(osrmPort), searoute: new SearouteEngine() }
    : { searoute: new SearouteEngine() };
  try {
    // RouteBatchManager のコンストラクタは可搬性のため deps を任意で受ける
    return new RouteBatchManager({ engines, emitter: deps?.emitter, store: deps?.store });
  } catch {
    return new RouteBatchManager();
  }
}
