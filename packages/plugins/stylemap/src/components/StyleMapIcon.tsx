/**
 * @file StyleMapIcon.tsx
 * @description StyleMap icon component
 */

import { BaseIcon, type BaseIconProps } from '@hierarchidb/ui-core';

export interface StyleMapIconProps extends BaseIconProps {
  nodeId?: string;
}

export const StyleMapIcon: React.FC<StyleMapIconProps> = ({ 
  nodeId: _nodeId, 
  size = 24,
  ...props 
}) => {
  return (
    <BaseIcon size={size} {...props} testId="stylemap-icon">
      📊
    </BaseIcon>
  );
};

export default StyleMapIcon;
