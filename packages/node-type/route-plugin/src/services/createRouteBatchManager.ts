import { RouteBatchManager, type ProgressEmitter, type ProgressStore } from './RouteBatchManager.js';
import { OsrmEngine } from './engines/OsrmEngine.js';
import { SearouteEngine } from './engines/SearouteEngine.js';
import { type NetworkPortLike as NetLike, ThrottledPort, type ThrottleOptions } from './net/ThrottledPort.js';

export interface NetworkPortLike extends NetLike {
}

export interface CreateRouteBatchManagerOptions {
  net?: NetworkPortLike;
  emitter?: ProgressEmitter;
  store?: ProgressStore;
  osrmThrottle?: ThrottleOptions;
}

export function createRouteBatchManager(options: CreateRouteBatchManagerOptions = {}): RouteBatchManager {
  const osrmPort = options.net ? (options.osrmThrottle ? new ThrottledPort(options.net, options.osrmThrottle) : options.net) : undefined;
  const engines = osrmPort
    ? { osrm: new OsrmEngine(osrmPort), searoute: new SearouteEngine() }
    : { searoute: new SearouteEngine() };
  try {
    return new RouteBatchManager({ engines, emitter: options.emitter, store: options.store });
  } catch {
    return new RouteBatchManager();
  }
}
