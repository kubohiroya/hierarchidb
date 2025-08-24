/**
 * @file BaseMapPanel.tsx
 * @description BaseMap panel component for sidebar display
 */

import React from 'react';
import type { BaseMapEntity } from '../types';

export interface BaseMapPanelProps {
  entity: BaseMapEntity;
  onEdit?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const BaseMapPanel: React.FC<BaseMapPanelProps> = ({ entity, onEdit, className, style }) => {
  return (
    <div className={className} style={style} data-testid="basemap-panel">
      <div className="basemap-panel-header">
        <h3>{entity.name}</h3>
        {onEdit && (
          <button onClick={onEdit} aria-label="Edit">
            Edit
          </button>
        )}
      </div>
      <div className="basemap-panel-content">
        {entity.description && <p>{entity.description}</p>}
        <dl>
          <dt>Style:</dt>
          <dd>{entity.mapStyle}</dd>
          <dt>Center:</dt>
          <dd>{entity.center.join(', ')}</dd>
          <dt>Zoom:</dt>
          <dd>{entity.zoom}</dd>
        </dl>
      </div>
    </div>
  );
};

export default BaseMapPanel;
