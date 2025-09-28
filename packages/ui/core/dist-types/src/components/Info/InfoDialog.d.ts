import type React from 'react';
import { type ReactNode } from 'react';
export interface InfoDialogProps {
    /**
     * Whether the base-dialog is open
     */
    open: boolean;
    /**
     * Callback when the base-dialog should close
     */
    onClose: () => void;
    /**
     * Title of the base-dialog
     */
    title?: ReactNode;
    /**
     * Icon to show before the title
     */
    titleIcon?: ReactNode;
    /**
     * Content to display in the base-dialog
     */
    children: ReactNode;
    /**
     * Whether to show the base-dialog in fullscreen mode
     */
    fullScreen?: boolean;
    /**
     * Maximum width of the base-dialog content
     */
    maxWidth?: string | number;
    /**
     * Custom close button text
     */
    closeButtonText?: string;
    /**
     * Additional action buttons to show
     */
    actions?: ReactNode;
    /**
     * Whether to disable the transition animation
     */
    disableTransition?: boolean;
}
/**
 * A generic information base-dialog component that can display any content
 * in a modal base-dialog with consistent styling and behavior.
 */
export declare const InfoDialog: ({ open, onClose, title, titleIcon, children, fullScreen, maxWidth, actions, disableTransition, }: InfoDialogProps) => React.ReactElement;
//# sourceMappingURL=InfoDialog.d.ts.map