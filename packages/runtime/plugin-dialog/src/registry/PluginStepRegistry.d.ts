/**
 * Plugin Step Registry
 * Manages plugin-provided dialog steps
 */
import { ReactNode } from 'react';
import { DialogStep } from '@hierarchidb/ui-dialog';
export interface StepLocalizationConfig {
    defaultTitle?: string;
    titles?: Partial<Record<string, string>>;
    translationKey?: string;
}
/**
 * Plugin step provider interface
 */
export interface PluginStepProvider {
    /** Node type this provider handles */
    nodeType: string;
    /** Get steps for create mode */
    getCreateSteps(): DialogStep[];
    /** Get steps for edit mode */
    getEditSteps(nodeId: string, data?: any): DialogStep[];
    /** Optional validation before showing dialog */
    validateAccess?(nodeId?: string): Promise<boolean>;
}
/**
 * New: Config-based provider that supplies typed component factories.
 */
export interface PluginStepConfigProvider {
    nodeType: string;
    getCreateStepConfigs(): PluginStepConfig[];
    getEditStepConfigs(nodeId: string, data?: any): PluginStepConfig[];
    validateAccess?(nodeId?: string): Promise<boolean>;
}
/**
 * Plugin step configuration
 */
export interface PluginStepConfig {
    /** Step ID */
    id: string;
    /** Step label */
    label: string;
    /** Optional localization metadata */
    localization?: StepLocalizationConfig;
    /** Step component factory */
    componentFactory: (props: StepComponentProps) => ReactNode;
    /** Validation function */
    validate?: (data?: any) => boolean | Promise<boolean>;
    /** Step capabilities */
    capabilities?: {
        canNavigateTo?: (fromStep: number, data: any) => boolean | Promise<boolean>;
        canStartBatch?: (data: any) => boolean | Promise<boolean>;
        canSave?: (data: any) => boolean | Promise<boolean>;
        canProceedToNext?: (data: any) => boolean | Promise<boolean>;
        canBackToPrevious?: (data: any) => boolean | Promise<boolean>;
    };
    /** Whether step is optional */
    optional?: boolean;
    /** Step icon */
    icon?: ReactNode;
}
/**
 * Props passed to step components
 */
export interface StepComponentProps {
    /** Dialog mode */
    mode: 'create' | 'edit';
    /** Node ID (for edit mode) */
    nodeId?: string;
    /** Parent node ID (for create mode) */
    parentId?: string;
    /** Current data */
    data: any;
    /** Update data */
    onChange: (data: any) => void;
    /** Mark step as valid/invalid */
    setValid: (valid: boolean) => void;
    /** Set step error message */
    setError: (error: string | null) => void;
}
/**
 * Plugin Step Registry
 */
export declare class PluginStepRegistry {
    private static instance;
    private providers;
    private configProviders;
    private listeners;
    private version;
    private constructor();
    /**
     * Get singleton instance
     */
    static getInstance(): PluginStepRegistry;
    /**
     * Register a step provider
     */
    register(provider: PluginStepProvider): void;
    /** Register a config-based provider (typed componentFactory) */
    registerConfigProvider(provider: PluginStepConfigProvider): void;
    /**
     * Unregister a step provider
     */
    unregister(nodeType: string): void;
    /**
     * Get provider for node type
     */
    getProvider(nodeType: string): PluginStepProvider | undefined;
    getConfigProvider(nodeType: string): PluginStepConfigProvider | undefined;
    /**
     * Get all registered node types
     */
    getRegisteredNodeTypes(): string[];
    /**
     * Get create steps for node type
     */
    getCreateSteps(nodeType: string): DialogStep[];
    /**
     * Get edit steps for node type
     */
    getEditSteps(nodeType: string, nodeId: string, data?: any): DialogStep[];
    /**
     * Validate access to node
     */
    validateAccess(nodeType: string, nodeId?: string): Promise<boolean>;
    /**
     * Clear all providers
     */
    clear(): void;
    /** Subscribe to registry changes. Returns an unsubscribe function. */
    subscribe(listener: () => void): () => void;
    /** Current change counter for convenient dependencies. */
    getVersion(): number;
    private emitChange;
}
//# sourceMappingURL=PluginStepRegistry.d.ts.map