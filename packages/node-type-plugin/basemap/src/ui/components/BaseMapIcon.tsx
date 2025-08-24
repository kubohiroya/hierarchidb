/**
 * BaseMap Icon Component
 */

import React from 'react';
import { Map as MapIcon } from '@mui/icons-material';
import { SvgIconProps } from '@mui/material';

export interface BaseMapIconProps extends SvgIconProps {
  // Additional props if needed
}

/**
 * Icon component for BaseMap nodes
 */
export const BaseMapIcon: React.FC<BaseMapIconProps> = (props) => {
  return <MapIcon {...props} />;
};