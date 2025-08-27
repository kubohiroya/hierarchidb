/**
 * @file BaseMapEditor.tsx
 * @description BaseMap edit component for map configuration
 * Migrated from packages/ui-routing/src/plugins/BasemapEditComponent.tsx
 */

import React, { useState } from 'react';
import type { BaseMapEntity, BaseMapWorkingCopy } from '../types';
import type { NodeId } from '@hierarchidb/common-core';
import { DEFAULT_MAP_CONFIG } from '../types';

export interface BaseMapEditorProps {
  treeId?: string;
  nodeId?: NodeId;
  entity?: BaseMapEntity;
  workingCopy?: BaseMapWorkingCopy;
  onSave?: (data: Partial<BaseMapEntity>) => void;
  onCancel?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * BaseMap editor component
 * Allows editing map configuration
 */
export const BaseMapEditor: React.FC<BaseMapEditorProps> = ({
  treeId,
  nodeId,
  entity,
  workingCopy,
  onSave,
  onCancel,
  className,
  style,
}) => {
  const initialData = workingCopy || entity || DEFAULT_MAP_CONFIG;

  const [formData, setFormData] = useState<Partial<BaseMapEntity>>({
    name: initialData.name || 'New Map',
    mapStyle: initialData.mapStyle || 'streets',
    center: initialData.center || [0, 0],
    zoom: initialData.zoom || 10,
    bearing: initialData.bearing || 0,
    pitch: initialData.pitch || 0,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (field: keyof BaseMapEntity, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name || formData.name.trim() === '') {
      newErrors.name = 'Name is required';
    }

    if (formData.center) {
      const [lng, lat] = formData.center;
      if (lng < -180 || lng > 180) {
        newErrors.center = 'Longitude must be between -180 and 180';
      }
      if (lat < -90 || lat > 90) {
        newErrors.center = 'Latitude must be between -90 and 90';
      }
    }

    if (formData.zoom !== undefined) {
      if (formData.zoom < 0 || formData.zoom > 22) {
        newErrors.zoom = 'Zoom must be between 0 and 22';
      }
    }

    if (formData.bearing !== undefined) {
      if (formData.bearing < 0 || formData.bearing > 360) {
        newErrors.bearing = 'Bearing must be between 0 and 360';
      }
    }

    if (formData.pitch !== undefined) {
      if (formData.pitch < 0 || formData.pitch > 60) {
        newErrors.pitch = 'Pitch must be between 0 and 60';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (validateForm() && onSave) {
      onSave(formData);
    }
  };

  return (
    <div className={className} style={style} data-testid="basemap-edit-component">
      <div className="basemap-edit-header">
        <h2>Edit BaseMap</h2>
        {treeId && <p>Tree ID: {treeId}</p>}
        {nodeId && <p>Node ID: {nodeId}</p>}
      </div>

      <form onSubmit={handleSubmit} className="basemap-edit-form">
        <div className="form-group">
          <label htmlFor="name">Name:</label>
          <input
            id="name"
            type="text"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            className={errors.name ? 'error' : ''}
          />
          {errors.name && <span className="error-message">{errors.name}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="mapStyle">Map Style:</label>
          <select
            id="mapStyle"
            value={formData.mapStyle}
            onChange={(e) => handleInputChange('mapStyle', e.target.value)}
          >
            <option value="streets">Streets</option>
            <option value="satellite">Satellite</option>
            <option value="hybrid">Hybrid</option>
            <option value="terrain">Terrain</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        <div className="form-group">
          <label>Center Coordinates:</label>
          <div className="coordinate-inputs">
            <input
              type="number"
              step="0.000001"
              placeholder="Longitude"
              value={formData.center?.[0] || 0}
              onChange={(e) =>
                handleInputChange('center', [
                  parseFloat(e.target.value) || 0,
                  formData.center?.[1] || 0,
                ])
              }
            />
            <input
              type="number"
              step="0.000001"
              placeholder="Latitude"
              value={formData.center?.[1] || 0}
              onChange={(e) =>
                handleInputChange('center', [
                  formData.center?.[0] || 0,
                  parseFloat(e.target.value) || 0,
                ])
              }
            />
          </div>
          {errors.center && <span className="error-message">{errors.center}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="zoom">Zoom Level (0-22):</label>
          <input
            id="zoom"
            type="number"
            min="0"
            max="22"
            step="0.1"
            value={formData.zoom}
            onChange={(e) => handleInputChange('zoom', parseFloat(e.target.value) || 0)}
          />
          {errors.zoom && <span className="error-message">{errors.zoom}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="bearing">Bearing (0-360°):</label>
          <input
            id="bearing"
            type="number"
            min="0"
            max="360"
            step="1"
            value={formData.bearing}
            onChange={(e) => handleInputChange('bearing', parseFloat(e.target.value) || 0)}
          />
          {errors.bearing && <span className="error-message">{errors.bearing}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="pitch">Pitch (0-60°):</label>
          <input
            id="pitch"
            type="number"
            min="0"
            max="60"
            step="1"
            value={formData.pitch}
            onChange={(e) => handleInputChange('pitch', parseFloat(e.target.value) || 0)}
          />
          {errors.pitch && <span className="error-message">{errors.pitch}</span>}
        </div>

        <div className="form-actions">
          <button type="submit">Save</button>
          {onCancel && (
            <button type="button" onClick={onCancel}>
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default BaseMapEditor;
