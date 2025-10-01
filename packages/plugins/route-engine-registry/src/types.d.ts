export type RouteEngineMethod = 'direct' | 'great_circle' | 'osm_route' | 'searoute' | 'custom' | string;
export interface RouteEngineResult {
    line: [number, number][];
    distance_m?: number;
    duration_s?: number;
}
export interface RouteEngineAdapter {
    readonly id: string;
    readonly method: RouteEngineMethod;
    route(points: [number, number][], options?: unknown): Promise<RouteEngineResult>;
}
export interface RouteEngineCapabilities {
    readonly maxConcurrency?: number;
    readonly fallback?: RouteEngineMethod;
    readonly tags?: readonly string[];
    readonly notes?: string;
}
export interface RouteEngineHelpers {
    readonly direct?: (points: [number, number][], options?: unknown) => Promise<RouteEngineResult> | RouteEngineResult;
    readonly greatCircle?: (points: [number, number][], options?: unknown) => Promise<RouteEngineResult> | RouteEngineResult;
}
export interface RouteEngineFactoryContext<TProvider = unknown> {
    readonly method: RouteEngineMethod;
    readonly provider?: TProvider;
    readonly helpers?: RouteEngineHelpers;
}
export interface RouteEngineDefinition<TProvider = unknown> {
    readonly id: string;
    readonly method: RouteEngineMethod;
    readonly factory: (ctx: RouteEngineFactoryContext<TProvider>) => RouteEngineAdapter | null | undefined;
    readonly capabilities?: RouteEngineCapabilities;
    readonly priority?: number;
}
export interface RouteEnginePreferences {
    readonly priority?: RouteEngineMethod[];
    readonly disabled?: RouteEngineMethod[];
}
export interface RouteEngineResolutionOptions {
    readonly fallbackOrder?: RouteEngineMethod[];
}
export type RouteEngineCapabilitiesMap = Record<RouteEngineMethod, RouteEngineCapabilities>;
//# sourceMappingURL=types.d.ts.map