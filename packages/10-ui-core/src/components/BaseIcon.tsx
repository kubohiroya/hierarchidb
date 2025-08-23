/**
 * BaseIcon Component
 * 
 * A standardized base component for creating plugin icons with consistent props.
 * Reduces duplication across icon containers by providing common functionality.
 */

import React from 'react';
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
 * Props for SVG-based icons
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
export function createSvgIcon(
  definition: SvgIconDefinition,
  displayName: string
): React.FC<BaseIconProps> {
  const Icon: React.FC<BaseIconProps> = ({
    size = 24,
    color = 'currentColor',
    className,
    testId,
    style,
  }) => {
    const { viewBox = '0 0 24 24', paths } = definition;
    
    return (
      <svg
        width={size}
        height={size}
        viewBox={viewBox}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        style={style}
        data-testid={testId || `${displayName.toLowerCase()}-icon`}
        aria-label={displayName}
      >
        {paths.map((path, index) => (
          <path
            key={index}
            d={path.d}
            fill={path.fill || color}
            stroke={path.stroke}
            strokeWidth={path.strokeWidth}
          />
        ))}
      </svg>
    );
  };
  
  Icon.displayName = displayName;
  return Icon;
}

/**
 * Creates a wrapper for MUI icons with consistent props
 * 
 * @example
 * ```typescript
 * import { Folder, FolderOpen } from '@mui/icons-material';
 * 
 * export const FolderIcon = createMuiIconWrapper(
 *   (props) => props.open ? FolderOpen : Folder,
 *   'FolderIcon'
 * );
 * ```
 */
export function createMuiIconWrapper<P extends BaseIconProps>(
  getIcon: (props: P) => React.ComponentType<SvgIconProps>,
  displayName: string
): React.FC<P> {
  const Icon: React.FC<P> = (props) => {
    const {
      size = 24,
      color = 'primary',
      className,
      testId,
      style,
      ...restProps
    } = props;
    
    const IconComponent = getIcon(props);
    
    // Map size to MUI fontSize
    const fontSize: 'small' | 'medium' | 'large' = 
      size <= 16 ? 'small' :
      size <= 24 ? 'medium' :
      'large';
    
    // Map color to MUI color or use style for custom colors
    const muiColor = ['inherit', 'action', 'disabled', 'primary', 'secondary', 'error', 'info', 'success', 'warning'].includes(color) 
      ? color as 'inherit' | 'action' | 'disabled' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'
      : undefined;
    
    const iconStyle = muiColor ? style : { ...style, color };
    
    return (
      <IconComponent
        fontSize={fontSize}
        color={muiColor}
        className={className}
        style={iconStyle}
        data-testid={testId || `${displayName.toLowerCase()}-icon`}
        {...restProps as Omit<typeof restProps, 'ref'>}
      />
    );
  };
  
  Icon.displayName = displayName;
  return Icon;
}

/**
 * Base icon component for simple implementations
 */
export const BaseIcon: React.FC<BaseIconProps & { children?: React.ReactNode }> = ({
  size = 24,
  color = 'currentColor',
  className,
  testId,
  style,
  children,
}) => {
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        color,
        ...style,
      }}
      data-testid={testId}
    >
      {children}
    </span>
  );
};

BaseIcon.displayName = 'BaseIcon';