import type { ReactNode } from 'react';
export interface PluginIconInfo {
    muiIconName?: string;
    emoji?: string;
    color?: string;
}
export interface PluginPresentation {
    nodeType: string;
    label: string;
    icon: PluginIconInfo;
    priority: number;
    description?: string;
}
export declare function getPresentation(nodeType: string): PluginPresentation | undefined;
export declare function getIconComponent(nodeType: string): ReactNode | undefined;
export declare function prefetchAllIcons(): Promise<void>;
//# sourceMappingURL=pluginPresentation.d.ts.map