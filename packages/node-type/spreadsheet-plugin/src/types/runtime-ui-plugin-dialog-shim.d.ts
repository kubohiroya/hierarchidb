declare module '@hierarchidb/runtime-ui-plugin-dialog' {
  export type StepComponentProps = {
    mode: 'create' | 'edit';
    nodeId?: string;
    parentId?: string;
    data: any;
    onChange: (data: any) => void;
    setValid: (valid: boolean) => void;
    setError: (error: string | null) => void;
  };

  export type PluginStepConfig = {
    id: string;
    label: string;
    componentFactory: (p: StepComponentProps) => any;
    validate?: (data?: any) => boolean | Promise<boolean>;
  };
  export type PluginStepConfigProvider = {
    nodeType: string;
    getCreateStepConfigs(): PluginStepConfig[];
    getEditStepConfigs(nodeId?: string, data?: any): PluginStepConfig[];
  };

  export class PluginStepRegistry {
    static getInstance(): PluginStepRegistry;
    registerConfigProvider(provider: PluginStepConfigProvider): void;
  }

  export const PluginDialogRoute: any;
}
