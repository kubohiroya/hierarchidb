/**
 * @file BaseMapView.tsx
 * @description BaseMap view component for displaying map
 * Migrated from packages/ui-routing/src/plugins/BasemapViewComponent.tsx
 */

import React, { useEffect, useState } from 'react';
import type { BaseMapEntity } from '../types';
import type { TreeNodeId } from '@hierarchidb/core';

export interface BaseMapViewProps {
  treeId?: string;
  nodeId?: TreeNodeId;
  entity?: BaseMapEntity;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * BaseMap view component
 * Displays the map in read-only mode
 */
export const BaseMapView: React.FC<BaseMapViewProps> = ({
  treeId,
  nodeId,
  entity,
  className,
  style,
}) => {
  const [mapEntity, setMapEntity] = useState<BaseMapEntity | undefined>(entity);
  const [loading, setLoading] = useState(!entity);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (entity) {
      setMapEntity(entity);
      setLoading(false);
      return;
    }

    if (!nodeId) {
      setError('No node ID provided');
      setLoading(false);
      return;
    }

    // TODO: Load entity from handler
    // For now, just use placeholder
    setLoading(false);
  }, [entity, nodeId]);

  if (loading) {
    return (
      <div className={className} style={style} data-testid="basemap-view-loading">
        <p>Loading map...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={className} style={style} data-testid="basemap-view-error">
        <p>Error: {error}</p>
      </div>
    );
  }

  return (
    <div className={className} style={style} data-testid="basemap-view-component">
      <div className="basemap-view-header">
        <h2>BaseMap View</h2>
        {treeId && <p>Tree ID: {treeId}</p>}
        {nodeId && <p>Node ID: {nodeId}</p>}
      </div>

      {mapEntity && (
        <div className="basemap-view-content">
          <div className="basemap-info">
            <h3>{mapEntity.name}</h3>
            {mapEntity.description && <p>{mapEntity.description}</p>}
            <dl>
              <dt>Style:</dt>
              <dd>{mapEntity.mapStyle}</dd>
              <dt>Center:</dt>
              <dd>{mapEntity.center.join(', ')}</dd>
              <dt>Zoom:</dt>
              <dd>{mapEntity.zoom}</dd>
              <dt>Bearing:</dt>
              <dd>{mapEntity.bearing}°</dd>
              <dt>Pitch:</dt>
              <dd>{mapEntity.pitch}°</dd>
            </dl>
          </div>

          <div
            className="basemap-view-map"
            style={{
              width: '100%',
              height: '400px',
              backgroundColor: '#e0e0e0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* MapLibre GL map would be rendered here */}
            <p>Map placeholder - MapLibre GL integration pending</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default BaseMapView;
