/**
 * @file StyleMapIcon.tsx
 * @description StyleMap icon component
 */

import React from 'react';

export interface StyleMapIconProps {
  nodeId: string;
  size?: number;
}

export const StyleMapIcon: React.FC<StyleMapIconProps> = ({ nodeId: _nodeId, size = 24 }) => {
  return (
    <div style={{ width: size, height: size }}>
      {/* TODO: Implement StyleMap icon */}
      📊
    </div>
  );
};

export default StyleMapIcon;
