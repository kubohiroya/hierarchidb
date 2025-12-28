import { RouteBatchSessionOrchestrator } from './RouteBatchSessionOrchestrator.js';
import type { RouteBatchManagerDeps } from './RouteBatchManager.js';
import { SearouteEngine } from '@hierarchidb/route-engine';
import { OsrmEngine } from './engines/OsrmEngine.js';
import { type NetworkPortLike as NetLike, ThrottledPort, type ThrottleOptions } from './net/ThrottledPort.js';

export interface NetworkPortLike extends NetLike {}

export interface CreateRouteBatchManagerOptions extends RouteBatchManagerDeps {
  net?: NetworkPortLike;
  osrmThrottle?: ThrottleOptions;
}

export function createRouteBatchManager(options: CreateRouteBatchManagerOptions = {}): RouteBatchSessionOrchestrator {
  const { net, osrmThrottle, emitter, store } = options;
  const osrmPort = net ? (osrmThrottle ? new ThrottledPort(net, osrmThrottle) : net) : undefined;
  const engines = osrmPort
    ? { osrm: new OsrmEngine(osrmPort), searoute: new SearouteEngine() }
    : { searoute: new SearouteEngine() };
  return new RouteBatchSessionOrchestrator({ engines, emitter, store });
}
