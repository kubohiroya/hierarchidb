import 'reflect-metadata';
import { Container, interfaces } from 'inversify';
import {
  pluginRegistry,
  pluginWorkerLoaders,
  pluginWorkerModuleMap,
  pluginWorkerSourceMap,
} from '../plugin-registry/index.js';
import { WorkerDiTokens } from './tokens.js';
import type { PluginWorkerModuleLoader as PluginWorkerModuleLoaderContract } from './interfaces.js';
import { PluginWorkerModuleLoader } from './PluginWorkerModuleLoader.js';

let containerInstance: Container | null = null;

const frozenRegistry = Object.freeze([...pluginRegistry]);
const frozenSpecMap = Object.freeze({ ...pluginWorkerModuleMap });
const frozenSourceMap = Object.freeze({ ...pluginWorkerSourceMap });
const frozenLoaderMap = Object.freeze({ ...pluginWorkerLoaders });

function createContainer(): Container {
  const container = new Container({ defaultScope: 'Singleton' });
  container.bind(WorkerDiTokens.PluginRegistry).toConstantValue(frozenRegistry);
  container.bind(WorkerDiTokens.PluginWorkerSpecifierMap).toConstantValue(frozenSpecMap);
  container.bind(WorkerDiTokens.PluginWorkerSourceMap).toConstantValue(frozenSourceMap);
  container.bind(WorkerDiTokens.PluginWorkerLoaderMap).toConstantValue(frozenLoaderMap);
  container
    .bind<PluginWorkerModuleLoaderContract>(WorkerDiTokens.PluginWorkerModuleLoader)
    .to(PluginWorkerModuleLoader)
    .inSingletonScope();
  return container;
}

export function getWorkerContainer(): Container {
  if (!containerInstance) {
    containerInstance = createContainer();
  }
  return containerInstance;
}

export function configureWorkerContainer(configure: (container: Container) => void): void {
  const container = getWorkerContainer();
  configure(container);
}

export function rebindWorkerContainer(binding: (container: Container) => void): void {
  const container = getWorkerContainer();
  binding(container);
}

export function resetWorkerContainerForTesting(): void {
  if (containerInstance) {
    containerInstance.unbindAll();
  }
  containerInstance = null;
}

export type WorkerContainer = interfaces.Container;
