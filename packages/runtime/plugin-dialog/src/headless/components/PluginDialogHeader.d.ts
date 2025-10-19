import type React from 'react';
import type { MultiStepDialogState, NodeId } from '@hierarchidb/common-types';
export interface PluginDialogHeaderProps {
    title: string;
    subtitle?: string;
    icon?: React.ReactNode;
    dialogState?: MultiStepDialogState | null;
    nodeType?: string;
    nodeId?: NodeId;
}
export declare const PluginDialogHeader: React.FC<PluginDialogHeaderProps>;
//# sourceMappingURL=PluginDialogHeader.d.ts.map