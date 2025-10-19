import { type PluginStepConfig } from '../registry/PluginStepRegistry.js';
export interface ComposeResult {
    configs: PluginStepConfig[];
    hasHostBase: boolean;
    hostCanSubmit?: (data: unknown) => boolean | Promise<boolean>;
}
export declare function composeStepConfigs(nodeType: string, mode: 'create' | 'edit'): ComposeResult;
//# sourceMappingURL=StepComposer.d.ts.map