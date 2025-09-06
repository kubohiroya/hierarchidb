import { RouteBatchManager } from './RouteBatchManager';
import { OsrmEngine } from './engines/OsrmEngine';
import { SearouteEngine } from './engines/SearouteEngine';
import { ThrottledPort, type ThrottleOptions, type NetworkPortLike as NetLike } from './net/ThrottledPort';

export interface NetworkPortLike extends NetLike {}

export function createRouteBatchManager(deps?: { net?: NetworkPortLike; emitter?: any; store?: any; osrmThrottle?: ThrottleOptions }) {
  const osrmPort = deps?.net ? (deps?.osrmThrottle ? new ThrottledPort(deps.net, deps.osrmThrottle) : deps.net) : undefined;
  const engines = osrmPort ? { osrm: new OsrmEngine(osrmPort), searoute: new SearouteEngine() } : ({ searoute: new SearouteEngine() } as any);
  try { return new (RouteBatchManager as any)({ engines, emitter: deps?.emitter, store: deps?.store }); } catch { return new RouteBatchManager() as any; }
}

