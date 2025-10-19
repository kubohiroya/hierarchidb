import type { PluginStepConfig } from './PluginStepRegistry.js';
export type HostName = string;
export interface HostProfileContext {
    nodeType: string;
}
export interface HostProfileProvider<TData = unknown> {
    name: HostName;
    getBaseStepConfigs: (mode: 'create' | 'edit', ctx: HostProfileContext) => PluginStepConfig[];
    canSubmit?: (data: TData) => boolean | Promise<boolean>;
}
export declare class HostProfileRegistry {
    private static singleton;
    private providers;
    private listeners;
    private version;
    static getInstance(): HostProfileRegistry;
    register<TData>(provider: HostProfileProvider<TData>): void;
    get(name: HostName): HostProfileProvider<any> | undefined;
    /**
     * Resolve host name for a given nodeType using global plugin definitions injected by the app.
     * Falls back to undefined when not found.
     */
    resolveHostForNodeType(nodeType: string): HostName | undefined;
    /** Subscribe to changes. Returns an unsubscribe function. */
    subscribe(listener: () => void): () => void;
    /** Current change counter. */
    getVersion(): number;
    private emitChange;
}
//# sourceMappingURL=HostProfileRegistry.d.ts.map