import type React from 'react';
import type { ReactNode } from 'react';
export interface InfoPanelAction {
    /**
     * Label for the button
     */
    label: string;
    /**
     * Icon to display in the button
     */
    icon?: ReactNode;
    /**
     * Click handler for the button
     */
    onClick: () => void;
    /**
     * Aria label for accessibility
     */
    ariaLabel?: string;
    /**
     * Button variant
     */
    variant?: 'text' | 'outlined' | 'contained';
    /**
     * Button color
     */
    color?: 'inherit' | 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';
}
export interface InfoPanelProps {
    /**
     * Main content to display
     */
    children: ReactNode;
    /**
     * Whether to show the action buttons
     */
    showActions?: boolean;
    /**
     * Actions to display as buttons
     */
    actions?: InfoPanelAction[];
    /**
     * Callback when info button is clicked
     */
    onInfoClick?: () => void;
    /**
     * Callback when help/tour button is clicked
     */
    onHelpClick?: () => void;
    /**
     * Custom info button label
     */
    infoButtonLabel?: string;
    /**
     * Custom help button label
     */
    helpButtonLabel?: string;
    /**
     * Button styling configuration
     */
    buttonStyle?: {
        textTransform?: 'none' | 'capitalize' | 'uppercase' | 'lowercase';
        color?: string;
        borderColor?: string;
        borderRadius?: number;
    };
}
/**
 * A panel component that displays information content with optional action buttons
 */
export declare const InfoPanel: ({ children, showActions, actions, onInfoClick, onHelpClick, infoButtonLabel, helpButtonLabel, buttonStyle, }: InfoPanelProps) => React.ReactElement;
//# sourceMappingURL=InfoPanel.d.ts.map