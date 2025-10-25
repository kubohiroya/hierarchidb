/**
 * PluginDialogFooter – renders navigation and action buttons for the dialog.
 *
 * Consumes multi-step dialog context to honour per-step enablement while
 * exposing plugin-specific commit/start-batch controls supplied by the
 * controller layer.
 */
import React from 'react';
export interface PluginDialogFooterPrimaryButtonOptions {
    leftVisibility?: 'auto' | 'hidden';
    rightVisibility?: 'auto' | 'hidden';
    leftLabelOverride?: string;
    rightLabelOverride?: string;
}
export interface PluginDialogFooterProps {
    mode: 'create' | 'edit';
    canCommit: boolean;
    onSaveDraft?: () => void;
    saveDraftLabel?: string;
    disableDraft?: boolean;
    onStartBatch?: () => void;
    canStartBatch?: boolean;
    primaryButtonOptions?: PluginDialogFooterPrimaryButtonOptions;
}
export declare const PluginDialogFooter: React.FC<PluginDialogFooterProps>;
//# sourceMappingURL=PluginDialogFooter.d.ts.map