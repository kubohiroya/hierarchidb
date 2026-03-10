import type { ReactNode } from 'react';
import { createContext, createElement, useContext } from 'react';
import {
  getMuiIconComponent,
  toPascalCase,
  prefetchMuiIcons,
  setGlobalMuiIconMap,
  getMuiIconWithColor,
} from './getMuiIconComponent.js';

export { getMuiIconComponent, toPascalCase, prefetchMuiIcons, setGlobalMuiIconMap, getMuiIconWithColor };
export * from './EriaCartLogo.js';

export interface IconDescriptorInput {
  nodeType?: string;
  icon?: {
    muiIconName?: string;
    emoji?: string;
    color?: string;
  };
}

export interface IconRegistryValue {
  readonly resolveIcon: (request: IconDescriptorInput) => ReactNode;
  readonly ready: boolean;
  readonly error: Error | null;
}

const defaultRegistry: IconRegistryValue = {
  resolveIcon: (request) =>
    getMuiIconWithColor(
      request?.icon?.muiIconName ?? request?.nodeType,
      request?.icon?.emoji,
      request?.icon?.color
    ),
  ready: true,
  error: null,
};

const IconRegistryContext = createContext<IconRegistryValue>(defaultRegistry);

export interface IconRegistryProviderProps {
  readonly value: IconRegistryValue;
  readonly children: ReactNode;
}

export function IconRegistryProvider({ value, children }: IconRegistryProviderProps) {
  return createElement(IconRegistryContext.Provider, { value }, children);
}

export function useIconRegistry(): IconRegistryValue {
  return useContext(IconRegistryContext);
}
