// TODO: Fix import path when ui-core/plugins/types is available
import React from 'react';
// import type { UIPluginDefinition } from '@hierarchidb/ui-core/plugins/types';
type UIPluginDefinition = any;
import { BaseMapIcon } from '../components/BaseMapIcon';
// import { BaseMapDialog } from '../components/BaseMapDialog';
import { BaseMapPanel } from '../components/BaseMapPanel';
import { BaseMapPreview } from '../components/BaseMapPreview';
import type { BaseMapEntity } from '../types';
import type { NodeId } from '@hierarchidb/common-core';

// Component definitions (moved to top to avoid hoisting issues)
interface CreateDialogProps {
  parentId: NodeId;
  onSubmit: (data: Partial<BaseMapEntity>) => Promise<void>;
  onCancel: () => void;
}

const BaseMapCreateDialog: React.FC<CreateDialogProps> = (_props) => {
  // TODO: Implement actual create dialog
  return null;
};

interface EditDialogProps {
  nodeId: NodeId;
  currentData: BaseMapEntity;
  onSubmit: (changes: Partial<BaseMapEntity>) => Promise<void>;
  onCancel: () => void;
}

const BaseMapEditDialog: React.FC<EditDialogProps> = (_props) => {
  // TODO: Implement actual edit dialog
  return null;
};

interface TableCellProps {
  nodeId: NodeId;
  data: BaseMapEntity;
  field: keyof BaseMapEntity;
  value: unknown;
}

const BaseMapTableCell: React.FC<TableCellProps> = (_props) => {
  // TODO: Implement actual table cell renderer
  return null;
};

/**
 * BaseMap UI Plugin Definition
 *
 * Handles the UI aspects of BaseMap nodes including creation, editing,
 * and display in the tree view.
 */
export const BaseMapUIPlugin: UIPluginDefinition = {
  nodeType: 'basemap',
  displayName: 'Base Map',
  description: 'Geographic base map with customizable styling and layers',

  dataSource: {
    requiresEntity: true,
    entityType: 'BaseMapEntity',
  },

  capabilities: {
    canCreate: true,
    canRead: true,
    canUpdate: true,
    canDelete: true,
    canHaveChildren: false, // BaseMap nodes are leaf nodes
    canMove: true,
    supportsWorkingCopy: true,
    supportsVersioning: true,
    supportsExport: true,
    supportsBulkOperations: false, // Maps are typically handled individually
  },

  components: {
    icon: BaseMapIcon,
    createDialog: BaseMapCreateDialog,
    editDialog: BaseMapEditDialog,
    detailPanel: BaseMapPanel,
    preview: BaseMapPreview,
    tableCell: BaseMapTableCell,
  },

  hooks: {
    beforeShowCreateDialog: async (_params: any) => {
      // Check if geolocation is available for better UX
      try {
        if ('geolocation' in navigator) {
          // Could prompt for location to set default center
          return { proceed: true };
        }
      } catch (error) {
        console.warn('Geolocation not available:', error);
      }

      return { proceed: true };
    },

    onShowCreateDialog: async (_params: { parentId: NodeId; onSubmit: any; onCancel: any }) => {
      // const _dialog = (
      //   <BaseMapCreateDialog parentId={parentId} onSubmit={onSubmit} onCancel={onCancel} />
      // );
      // TODO: Show dialog via dialog service
      console.log('Show BaseMap create dialog');
    },

    onValidateCreateForm: async ({ formData }: { formData: any }) => {
      const errors: Record<string, string> = {};
      const warnings: string[] = [];

      // Name validation
      if (!formData.name?.trim()) {
        errors.name = 'Map name is required';
      } else if (formData.name.length > 255) {
        errors.name = 'Map name is too long (maximum 255 characters)';
      }

      // Coordinate validation
      if (formData.center && Array.isArray(formData.center)) {
        const [lng, lat] = formData.center;
        if (lng < -180 || lng > 180) {
          errors.coordinates = 'Longitude must be between -180 and 180';
        }
        if (lat < -90 || lat > 90) {
          errors.coordinates = 'Latitude must be between -90 and 90';
        }
      }

      // Zoom level validation
      if (formData.zoom !== undefined) {
        if (formData.zoom < 0 || formData.zoom > 22) {
          errors.zoom = 'Zoom level must be between 0 and 22';
        }
        if (formData.zoom > 18) {
          warnings.push('High zoom levels may have limited tile availability');
        }
      }

      // Map style validation
      if (formData.mapStyle) {
        const validStyles = ['streets', 'satellite', 'hybrid', 'terrain', 'custom'];
        if (!validStyles.includes(formData.mapStyle)) {
          errors.mapStyle = `Map style must be one of: ${validStyles.join(', ')}`;
        }

        if (formData.mapStyle === 'custom' && !formData.styleUrl && !formData.styleConfig) {
          errors.mapStyle = 'Custom style requires either styleUrl or styleConfig';
        }
      }

      // Bearing validation
      if (formData.bearing !== undefined) {
        if (formData.bearing < 0 || formData.bearing > 360) {
          errors.bearing = 'Bearing must be between 0 and 360 degrees';
        }
      }

      // Pitch validation
      if (formData.pitch !== undefined) {
        if (formData.pitch < 0 || formData.pitch > 60) {
          errors.pitch = 'Pitch must be between 0 and 60 degrees';
        }
      }

      return {
        valid: Object.keys(errors).length === 0,
        errors: Object.keys(errors).length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    },

    afterCreate: async ({ nodeId, data }: { nodeId: NodeId; data: any }) => {
      return {
        showMessage: `Map "${data.name}" created successfully`,
        navigateTo: nodeId,
      };
    },

    onFormatDisplay: async ({ data, field }: { data: any; field: string; viewType?: string }) => {
      switch (field) {
        case 'coordinates':
          if (data.center && Array.isArray(data.center)) {
            const [lng, lat] = data.center;
            return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
          }
          return 'Unknown location';

        case 'zoom':
          return `Level ${data.zoom || 0}`;

        case 'style':
          return (
            data.mapStyle?.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) ||
            'Default'
          );

        case 'size':
          if (data.bounds) {
            const [minLng, minLat, maxLng, maxLat] = data.bounds;
            const width = maxLng - minLng;
            const height = maxLat - minLat;
            return `${width.toFixed(3)}° × ${height.toFixed(3)}°`;
          }
          return 'Not calculated';

        case 'bearing':
          return data.bearing !== undefined ? `${data.bearing}°` : 'North';

        case 'pitch':
          return data.pitch !== undefined ? `${data.pitch}°` : 'Flat';

        default:
          return null;
      }
    },

    onGeneratePreview: async ({ data }: { nodeId: NodeId; data: any }) => {
      return () => <BaseMapPreview entity={data as BaseMapEntity} />;
    },

    beforeStartEdit: async (_params: any) => {
      // Allow editing all fields except system-output ones
      return {
        proceed: true,
        editableFields: [
          'name',
          'description',
          'center',
          'zoom',
          'mapStyle',
          'styleUrl',
          'styleConfig',
          'bearing',
          'pitch',
          'bounds',
        ],
        readOnlyFields: ['createdAt', 'version'],
      };
    },

    onShowEditDialog: async (_params: {
      nodeId: NodeId;
      currentData: any;
      onSubmit: any;
      onCancel: any;
    }) => {
      // const _dialog = (
      //   <BaseMapEditDialog
      //     nodeId={nodeId}
      //     currentData={currentData}
      //     onSubmit={onSubmit}
      //     onCancel={onCancel}
      //   />
      // );
      // TODO: Show dialog via dialog service
      console.log('Show BaseMap edit dialog');
    },

    afterUpdate: async ({
      nodeId,
      changes,
    }: {
      nodeId: NodeId;
      changes: any;
      updatedData: any;
    }) => {
      let message = 'Map updated successfully';

      if (changes.name) {
        message = `Map renamed to "${changes.name}"`;
      } else if (changes.center) {
        message = 'Map location updated';
      } else if (changes.mapStyle) {
        message = 'Map style updated';
      }

      return {
        showMessage: message,
        refreshNodes: [nodeId],
      };
    },

    beforeDelete: async ({ nodeIds }: { nodeIds: NodeId[]; entities: any[] }) => {
      const count = nodeIds.length;
      const mapWord = count === 1 ? 'map' : 'maps';

      return {
        proceed: true,
        confirmMessage: `Delete ${count} ${mapWord}? This action cannot be undone.`,
      };
    },

    afterDelete: async ({
      deletedNodeIds,
      parentIds,
    }: {
      deletedNodeIds: NodeId[];
      parentIds: NodeId[];
    }) => {
      const count = deletedNodeIds.length;
      const message =
        count === 1 ? 'Map deleted successfully' : `${count} maps deleted successfully`;

      return {
        showMessage: message,
        refreshNodes: parentIds,
      };
    },

    onExport: async ({ nodeIds, format }: { nodeIds: NodeId[]; format: string }) => {
      // Get map data for all nodes
      const maps = await Promise.all(
        nodeIds.map(async (id: NodeId) => {
          // TODO: Get data via nodeAdapter
          return { id, name: 'Map', center: [0, 0] }; // Placeholder
        })
      );

      switch (format) {
        case 'geojson':
          const features = maps.map((mapData) => ({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: mapData.center,
            },
            properties: {
              name: mapData.name,
              id: mapData.id,
            },
          }));

          const geoJson = {
            type: 'FeatureCollection',
            features,
          };

          return new Blob([JSON.stringify(geoJson, null, 2)], {
            type: 'application/geo+json',
          });

        case 'kml':
          // Simple KML export
          let kml = '<?xml version="1.0" encoding="UTF-8"?>\n';
          kml += '<kml xmlns="http://www.opengis.net/kml/2.2">\n';
          kml += '  <Document>\n';

          for (const map of maps) {
            kml += '    <Placemark>\n';
            kml += `      <name>${map.name}</name>\n`;
            kml += '      <Point>\n';
            kml += `        <coordinates>${map.center[0]},${map.center[1]},0</coordinates>\n`;
            kml += '      </Point>\n';
            kml += '    </Placemark>\n';
          }

          kml += '  </Document>\n';
          kml += '</kml>';

          return new Blob([kml], {
            type: 'application/vnd.google-earth.kml+xml',
          });

        case 'json':
          return new Blob([JSON.stringify(maps, null, 2)], {
            type: 'application/json',
          });

        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
    },

    onContextMenu: async ({ nodeId, data }: { nodeId: NodeId; data: any }) => {
      return [
        {
          label: 'Open in Map Editor',
          icon: 'edit_location',
          action: () => {
            // TODO: Navigate to map editor
            console.log(`Open map editor for ${nodeId}`);
          },
        },
        {
          label: 'Duplicate Map',
          icon: 'content_copy',
          action: () => {
            // TODO: Implement map duplication
            console.log(`Duplicate map ${nodeId}`);
          },
        },
        {
          type: 'divider',
        },
        {
          label: 'Export as GeoJSON',
          icon: 'download',
          action: () => {
            // TODO: Trigger export
            console.log(`Export ${nodeId} as GeoJSON`);
          },
        },
        {
          label: 'Export as KML',
          icon: 'download',
          action: () => {
            // TODO: Trigger export
            console.log(`Export ${nodeId} as KML`);
          },
        },
        {
          type: 'divider',
        },
        {
          label: 'Share Map',
          icon: 'share',
          action: () => {
            // TODO: Implement sharing
            console.log(`Share map ${nodeId}`);
          },
        },
        {
          label: 'View on External Map',
          icon: 'open_in_new',
          action: () => {
            if (data.center) {
              const [lng, lat] = data.center;
              const zoom = data.zoom || 10;
              window.open(`https://www.openstreetmap.org/#map=${zoom}/${lat}/${lng}`, '_blank');
            }
          },
        },
      ];
    },
  },

  menu: {
    createOrder: 10,
    group: 'document',
  },

  style: {
    primaryColor: '#4CAF50',
    icon: 'map',
  },
};

export default BaseMapUIPlugin;
