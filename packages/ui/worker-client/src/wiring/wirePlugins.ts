// Local copy of shared type to avoid stage-time cross-package coupling
export interface PluginRuntimeWiring {
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
      const callable = fn as (...args: unknown[]) => unknown;
      wiring[key] = () => {
        const result = callable.call(source);
        return result as void | Promise<void>;
      };
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
      const callable = value as (...args: unknown[]) => unknown;
      lifecycle[name] = (...args: unknown[]) => callable.apply(source, args);
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
      const moduleRecord: Record<string, unknown> | null =
        (typeof mod === 'object' || typeof mod === 'function') && mod !== null
          ? (mod as Record<string, unknown>)
          : null;
      const wiringCandidates: PluginRuntimeWiring[] = [];
      const objectWiring = toRuntimeWiring(moduleRecord?.runtimeWiring);
      if (objectWiring) wiringCandidates.push(objectWiring);
      const classWiring = toRuntimeWiring(moduleRecord?.RuntimeWiring);
      if (classWiring) wiringCandidates.push(classWiring);

      for (const wiring of wiringCandidates) {
        if (typeof wiring.registerAuthNotifier === 'function') {
          await wiring.registerAuthNotifier();
        }
        if (typeof wiring.registerRuntimeWorkerAdapters === 'function') {
          await wiring.registerRuntimeWorkerAdapters();
        }
      }
      // Register standardized factories/lifecycle when present
      const exp: Record<string, unknown> = {};
      const workerSource =
        moduleRecord?.worker && typeof moduleRecord.worker === 'object'
          ? (moduleRecord.worker as Record<string, unknown>)
          : moduleRecord;
      if (workerSource && typeof workerSource.createEntityHandler === 'function') {
        exp.createEntityHandler = workerSource.createEntityHandler;
      }
      if (workerSource && typeof workerSource.createBatchManager === 'function') {
        exp.createBatchManager = workerSource.createBatchManager;
      }

      const workerLifecycle =
        workerSource?.lifecycle && typeof workerSource.lifecycle === 'object'
          ? (workerSource.lifecycle as Record<string, unknown>)
          : toLifecycle(workerSource?.Lifecycle);
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
