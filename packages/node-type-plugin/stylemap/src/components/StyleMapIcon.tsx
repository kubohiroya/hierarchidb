/**
 * @file StyleMapIcon.tsx
 * @description StyleMap icon component
 */

import React from 'react';

export interface StyleMapIconProps {
  nodeId?: string;
  size?: number;
  className?: string;
}

export const StyleMapIcon: React.FC<StyleMapIconProps> = ({ 
  nodeId: _nodeId, 
  size = 24,
  className
}) => {
  return (
    <span 
      className={className}
      style={{ fontSize: size }}
      data-testid="stylemap-icon"
    >
      📊
    </span>
  );
};

export default StyleMapIcon;
