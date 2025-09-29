/**
  * NodeTypeIcon -
    */
import type { MouseEvent } from 'react';
interface NodeTypeIconProps {
    nodeType: string;
    size?: 'small' | 'medium' | 'large';
    clickable?: boolean;
    onClick?: (event: MouseEvent<HTMLElement>) => void;
    disabled?: boolean;
    color?: 'inherit' | 'primary' | 'secondary' | 'action' | 'disabled' | 'error';
    /** Optional explicit svg color (hex or css). */
    htmlColor?: string;
}
/**
  * NodeTypeIcon
  */
export declare function NodeTypeIcon({ nodeType, size, clickable, onClick, disabled, color, htmlColor, }: NodeTypeIconProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=NodeTypeIcon.d.ts.map