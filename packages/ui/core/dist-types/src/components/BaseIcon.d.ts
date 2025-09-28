/**
 * BaseIcon Component
 *
 * A standardized base component for creating plugin icon with consistent props.
 * Reduces duplication across icon containers by providing common functionality.
 */
import type React from 'react';
import type { SvgIconProps } from '@mui/material';
/**
 * Base props for all plugin icon containers
 */
export interface BaseIconProps {
    /**
     * Size of the icon in pixels
     * @default 24
     */
    size?: number;
    /**
     * Color of the icon (can be MUI color tokens or CSS color values)
     * @default 'currentColor'
     */
    color?: 'inherit' | 'action' | 'disabled' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' | string;
    /**
     * Additional CSS class name
     */
    className?: string;
    /**
     * Test ID for testing
     */
    testId?: string;
    /**
     * Additional CSS styles
     */
    style?: React.CSSProperties;
}
/**
 * Props for SVG-based icon
 */
export interface SvgIconDefinition {
    viewBox?: string;
    paths: Array<{
        d: string;
        fill?: string;
        stroke?: string;
        strokeWidth?: number;
    }>;
}
/**
 * Creates a standardized SVG icon component
 *
 * @example
 * ```typescript
 * export const MapIcon = createSvgIcon({
 *   paths: [{
 *     d: "M20.5 3L20.34 3.03L15 5.1...",
 *   }]
 * }, 'MapIcon');
 * ```
 */
export declare function createSvgIcon(definition: SvgIconDefinition, displayName: string): React.FC<BaseIconProps>;
/**
 * Creates a wrapper for MUI icon with consistent props
 *
 * @example
 * ```typescript
 * import { Folder, FolderOpen } from '@mui/icon-material';
 *
 * export const FolderIcon = createMuiIconWrapper(
 *   (props) => props.open ? FolderOpen : Folder,
 *   'FolderIcon'
 * );
 * ```
 */
export declare function createMuiIconWrapper<P extends BaseIconProps>(getIcon: (props: P) => React.ComponentType<SvgIconProps>, displayName: string): React.FC<P>;
/**
 * Base icon component for simple implementations
 */
export declare const BaseIcon: React.FC<BaseIconProps & {
    children?: React.ReactNode;
}>;
//# sourceMappingURL=BaseIcon.d.ts.map