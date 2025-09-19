// Local copy of shared type to avoid build-time cross-package coupling
export interface PluginRuntimeWiring {
  registerSharedDownloadService?: () => Promise<void> | void;
  registerAuthNotifier?: () => Promise<void> | void;
  registerRuntimeWorkerAdapters?: () => Promise<void> | void;
}

/**
 * wirePluginsFromModules
 * Reflectively scans given modules for an exported `runtimeWiring` object/class and
 * calls its optional hooks in a safe, best-effort manner.
 */
import { registerRuntimeExports } from './runtime-export-registry.js';

const RUNTIME_METHOD_KEYS: Array<keyof PluginRuntimeWiring> = [
  'registerSharedDownloadService',
  'registerAuthNotifier',
  'registerRuntimeWorkerAdapters',
];

function toRuntimeWiring(candidate: unknown): PluginRuntimeWiring | undefined {
  if (!candidate) return undefined;
  const wiring: PluginRuntimeWiring = {};
  const source = candidate as Record<string, unknown>;
  let hasMember = false;
  for (const key of RUNTIME_METHOD_KEYS) {
    const fn = source[key];
    if (typeof fn === 'function') {
      wiring[key] = () => (fn as Function).call(source);
      hasMember = true;
    }
  }
  return hasMember ? wiring : undefined;
}

function toLifecycle(candidate: unknown): Record<string, unknown> | undefined {
  if (!candidate) return undefined;
  const source = candidate as Record<string, unknown>;
  const lifecycle: Record<string, unknown> = {};
  const names = Object.getOwnPropertyNames(source);
  let hasMember = false;
  for (const name of names) {
    if (['length', 'name', 'prototype'].includes(name)) continue;
    const value = source[name];
    if (typeof value === 'function') {
      lifecycle[name] = (...args: unknown[]) => (value as Function).apply(source, args);
      hasMember = true;
    }
  }
  return hasMember ? lifecycle : undefined;
}

export interface PluginModuleEntry {
  nodeType: string;
  mod: unknown;
}

export async function wirePluginsFromModules(entries: PluginModuleEntry[]): Promise<void> {
  for (const entry of entries) {
    const mod = entry.mod;
    try {
      const m = mod as any;
      const wiringCandidates: PluginRuntimeWiring[] = [];
      const objectWiring = toRuntimeWiring(m?.runtimeWiring);
      if (objectWiring) wiringCandidates.push(objectWiring);
      const classWiring = toRuntimeWiring(m?.RuntimeWiring);
      if (classWiring) wiringCandidates.push(classWiring);

      for (const wiring of wiringCandidates) {
        if (typeof wiring.registerSharedDownloadService === 'function') {
          await wiring.registerSharedDownloadService();
        }
        if (typeof wiring.registerAuthNotifier === 'function') {
          await wiring.registerAuthNotifier();
        }
        if (typeof wiring.registerRuntimeWorkerAdapters === 'function') {
          await wiring.registerRuntimeWorkerAdapters();
        }
      }
      // Register standardized factories/lifecycle when present
      const exp: any = {};
      const workerSide = m?.worker || m; // tolerate packaging that nests exports under .worker
      if (typeof workerSide?.createEntityHandler === 'function') exp.createEntityHandler = workerSide.createEntityHandler;
      if (typeof workerSide?.createBatchManager === 'function') exp.createBatchManager = workerSide.createBatchManager;

      const workerLifecycle = workerSide?.lifecycle && typeof workerSide.lifecycle === 'object'
        ? workerSide.lifecycle
        : toLifecycle(workerSide?.Lifecycle);
      if (workerLifecycle) {
        exp.lifecycle = workerLifecycle;
      }
      if (Object.keys(exp).length > 0) {
        registerRuntimeExports(entry.nodeType, exp);
      }
    } catch (e) {
      console.warn('[wirePlugins] wiring failed for a module:', e);
    }
  }
}
