import type { ComponentType } from 'react';
import type { DialogStepDefinition, PeerEntity } from '@hierarchidb/common-type';
import { NodeDialogPlugin } from './NodeDialogPlugin.js';
export interface DialogStepConfig<TProps extends object> {
    id: string;
    label: string;
    component: ComponentType<TProps>;
    validation?: {
        validate: (data: TProps) => Promise<{
            isValid: boolean;
            errors?: string[];
        }>;
        canProceed?: (data: TProps) => boolean;
    };
    required?: boolean;
    order?: number;
}
export declare abstract class BaseDialogPlugin<TDialog extends PeerEntity = PeerEntity> extends NodeDialogPlugin<TDialog> {
    protected createDialogStep<TProps extends object>(config: DialogStepConfig<TProps>): DialogStepDefinition;
}
export default BaseDialogPlugin;
//# sourceMappingURL=BaseDialogPlugin.d.ts.map