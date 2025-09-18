declare module '@hierarchidb/runtime-ui-plugin-dialog' {
  // Minimal shim to satisfy typecheck in UI-only builds
  export const PluginDialogRoute: any;
  export class PluginStepRegistry {
    static getInstance(): PluginStepRegistry;
    registerConfigProvider(_p: { nodeType: string; getCreateStepConfigs(): any[]; getEditStepConfigs(nodeId?: string, data?: any): any[] }): void;
  }
  export type StepComponentProps = {
    mode: 'create' | 'edit';
    nodeId?: string;
    parentId?: string;
    data: any;
    onChange: (data: any) => void;
    setValid: (valid: boolean) => void;
    setError: (error: string | null) => void;
  };
}
