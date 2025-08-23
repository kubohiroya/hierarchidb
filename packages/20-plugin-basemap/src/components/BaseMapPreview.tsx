/**
 * @file BaseMapPreview.tsx
 * @description BaseMap preview component for quick view
 */

import React from 'react';
import type { BaseMapEntity } from '../types';

export interface BaseMapPreviewProps {
  entity: BaseMapEntity;
  className?: string;
  style?: React.CSSProperties;
}

export const BaseMapPreview: React.FC<BaseMapPreviewProps> = ({ entity, className, style }) => {
  return (
    <div className={className} style={style} data-testid="basemap-preview">
      <h4>{entity.name}</h4>
      <p>Style: {entity.mapStyle}</p>
      <p>Zoom: {entity.zoom}</p>
    </div>
  );
};

export default BaseMapPreview;
