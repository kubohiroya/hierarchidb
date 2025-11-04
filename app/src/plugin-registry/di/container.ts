import 'reflect-metadata';
import { Container } from 'inversify';
import { pluginDefinitions, pluginRegistry, pluginUiLoaders, pluginUiModuleMap } from '../index.js';
import type { PluginUiModuleLoader as PluginUiModuleLoaderContract } from './interfaces.js';
import { PluginUiModuleLoader } from './PluginUiModuleLoader.js';
import { UIPluginRegistryTokens } from './tokens.js';

let containerInstance: Container | null = null;

const frozenDefinitions = Object.freeze([...pluginDefinitions]);
const frozenRegistry = Object.freeze([...pluginRegistry]);
const frozenSpecMap = Object.freeze({ ...pluginUiModuleMap });
const frozenLoaderMap = Object.freeze({ ...pluginUiLoaders });

function createContainer(): Container {
  const container = new Container({ defaultScope: 'Singleton' });
  container.bind(UIPluginRegistryTokens.PluginDefinitions).toConstantValue(frozenDefinitions);
  container.bind(UIPluginRegistryTokens.PluginRegistry).toConstantValue(frozenRegistry);
  container.bind(UIPluginRegistryTokens.PluginUiModuleMap).toConstantValue(frozenSpecMap);
  container.bind(UIPluginRegistryTokens.PluginUiLoaders).toConstantValue(frozenLoaderMap);
  container
    .bind<PluginUiModuleLoaderContract>(UIPluginRegistryTokens.PluginUiModuleLoader)
    .to(PluginUiModuleLoader)
    .inSingletonScope();
  return container;
}

export function getPluginRegistryContainer(): Container {
  if (!containerInstance) {
    containerInstance = createContainer();
  }
  return containerInstance;
}

export function configurePluginRegistryContainer(configure: (container: Container) => void): void {
  const container = getPluginRegistryContainer();
  configure(container);
}

export function resetPluginRegistryContainerForTesting(): void {
  if (containerInstance) {
    containerInstance.unbindAll();
  }
  containerInstance = null;
}
