import type { RouteEngineAdapter, RouteEngineCapabilitiesMap, RouteEngineDefinition, RouteEngineFactoryContext, RouteEngineMethod, RouteEnginePreferences, RouteEngineResolutionOptions } from './types.js';
export declare function clearRouteEngineRegistry(): void;
export declare function registerRouteEngine<TProvider = unknown>(definition: RouteEngineDefinition<TProvider>): void;
export declare function configureRouteEnginePreferences(next?: RouteEnginePreferences): void;
export declare function getRouteEnginePreferences(): RouteEnginePreferences;
export declare function resolveRouteEngine<TProvider = unknown>(method: RouteEngineMethod, ctx: RouteEngineFactoryContext<TProvider>, options?: RouteEngineResolutionOptions): RouteEngineAdapter | null;
export declare function getRouteEngineCapabilities(): RouteEngineCapabilitiesMap;
export declare function readRouteEnginePreferences(): RouteEnginePreferences;
export declare function isRouteEngineRegistryEnabled(fallback?: boolean): boolean;
//# sourceMappingURL=RouteEngineRegistry.d.ts.map