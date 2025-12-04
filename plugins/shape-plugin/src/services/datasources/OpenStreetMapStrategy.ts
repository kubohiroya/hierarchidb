/**
  * OpenStreetMap Overpass API
 * https://overpass-api.de/ OSM
  */

import {
  BaseDataSourceStrategy,
  type BoundingBox,
  type DataSourceConfig,
  type FetchOptions,
  type ProcessOptions,
} from './DataSourceStrategy.js';
import type { NodeId, ShapeEntity } from '../../common/shared/types.js';

//  OSM
export interface OSMRawData {
  elements: OSMElement[];
  metadata: {
    source: 'osm-overpass';
    downloadedAt: string;
    query: string;
    bbox?: BoundingBox;
    timeout: number;
    generator: string;
  };
}

//  OSM
export interface OSMElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  members?: OSMMember[];
  tags?: Record<string, string>;
  timestamp?: string;
  version?: number;
  changeset?: number;
  user?: string;
  uid?: number;
}

export interface OSMMember {
  type: 'node' | 'way' | 'relation';
  ref: number;
  role?: string;
}

//  OSM
export interface OSMProcessedData extends Array<ShapeEntity> {
  metadata?: {
    source: 'osm-overpass';
    processedAt: string;
    count: number;
    originalElementCount: number;
    query: string;
    bbox?: BoundingBox;
  };
}

/**
  * OpenStreetMap Overpass API
  */
export class OpenStreetMapStrategy extends BaseDataSourceStrategy<OSMRawData, OSMProcessedData> {
  readonly id = 'openstreetmap-overpass';
  readonly name = 'OpenStreetMap Overpass API';
  readonly config: DataSourceConfig = {
    id: 'openstreetmap-overpass',
    name: 'OpenStreetMap via Overpass API',
    description: 'Live OpenStreetMap data through Overpass API queries',
    version: '0.7.60',
    access: {
      method: 'REST',
      baseUrl: 'https://overpass-api.de/api/',
      endpoints: {
        interpreter: 'interpreter',
        status: 'status',
        kill_my_queries: 'kill_my_queries',
      },
      authentication: { type: 'none' },
      timeout: 180000, //  3Overpass API
      retries: { count: 2, delay: 10000, backoff: 'linear' },
      rateLimit: {
        requests: 2, //  2
        period: 60000, //  1
      },
    },
    processing: {
      inputFormat: 'json', // Overpass JSON
      outputFormat: 'geojson',
      validation: [
        { field: 'type', rule: 'required' },
        { field: 'id', rule: 'required' },
      ],
      transformations: [
        { type: 'coordinate-system', from: 'EPSG:4326', to: 'EPSG:4326' },
      ],
    },
    cache: {
      ttl: 3600000, //  1OSM
      strategy: 'memory',
    },
  };

  //  OSM
  private readonly tagPresets: Record<string, any> = {
    administrative: {
      query: '[admin_level][boundary=administrative]',
      description: 'Administrative boundaries',
    },
    countries: {
      query: '[admin_level=2][boundary=administrative]',
      description: 'Country boundaries',
    },
    states: {
      query: '[admin_level~"^(3|4)$"][boundary=administrative]',
      description: 'State/Province boundaries',
    },
    cities: {
      query: '[place~"^(city|town|village)$"]',
      description: 'Cities and towns',
    },

    coastlines: {
      query: '[natural=coastline]',
      description: 'Coastlines',
    },
    rivers: {
      query: '[waterway=river]',
      description: 'Rivers',
    },
    lakes: {
      query: '[natural=water][water=lake]',
      description: 'Lakes',
    },
    forests: {
      query: '[landuse=forest]',
      description: 'Forests',
    },

    highways: {
      query: '[highway~"^(motorway|trunk|primary|secondary)$"]',
      description: 'Major roads',
    },
    railways: {
      query: '[railway=rail]',
      description: 'Railways',
    },
    airports: {
      query: '[aeroway=aerodrome]',
      description: 'Airports',
    },
  };

  async fetchData(options?: FetchOptions): Promise<OSMRawData> {
    const {
      bbox,
      tags = [],
      query,
      timeout = 25, //  Overpass API
      endpoint: _endpoint = 'interpreter',
    } = options || {};

    try {
      //  Overpass QL
      const overpassQuery = query || this.buildOverpassQuery(bbox, tags, timeout);

      console.log(`[OSM] Executing Overpass query: ${overpassQuery.substring(0, 200)}...`);

      //  Overpass API
      const response = await this.executeOverpassQuery(overpassQuery);

      if (!response.elements || !Array.isArray(response.elements)) {
        throw new Error('Invalid response format from Overpass API');
      }

      return {
        elements: response.elements,
        metadata: {
          source: 'osm-overpass',
          downloadedAt: new Date().toISOString(),
          query: overpassQuery,
          bbox,
          timeout: timeout * 1000, generator: response.generator || 'Overpass API',
        },
      };

    } catch (error) {
      throw new Error(`Failed to fetch OSM data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async processData(rawData: OSMRawData, options?: ProcessOptions): Promise<OSMProcessedData> {
    const { filters, transformations } = options || {};

    try {
      //  OSMGeoJSON
      const features = await this.convertOSMElementsToFeatures(rawData.elements);

      let filteredFeatures = features;
      if (filters && filters.length > 0) {
        filteredFeatures = await this.applyFilters(features, filters);
      }

      if (transformations && transformations.length > 0) {
        filteredFeatures = await this.applyTransformations(filteredFeatures, transformations);
      }

      //  ShapeEntity
      const entities: ShapeEntity[] = filteredFeatures.map((feature) => {
        const properties = feature.properties || {};
        const osmElement = feature.osmElement as OSMElement;

        const entityId = this.generateEntityId(osmElement) as NodeId;
        const nodeId = this.generateNodeId(osmElement) as NodeId;

        return {
          id: entityId,
          nodeId,
          geometry: feature.geometry,
          properties: {
            ...properties,
            source: 'osm-overpass',
            osmId: osmElement.id,
            osmType: osmElement.type,
            osmTags: osmElement.tags || {},
            osmVersion: osmElement.version,
            osmChangeset: osmElement.changeset,
            osmTimestamp: osmElement.timestamp,
          },
          metadata: {
            name: this.extractName(osmElement) ?? 'OSM feature',
            description: this.extractDescription(osmElement) ?? '',
            tags: [],
          },
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        } as ShapeEntity;
      });

      const result = entities as OSMProcessedData;
      result.metadata = {
        source: 'osm-overpass',
        processedAt: new Date().toISOString(),
        count: entities.length,
        originalElementCount: rawData.elements.length,
        query: rawData.metadata.query,
        bbox: rawData.metadata.bbox,
      };

      return result;

    } catch (error) {
      throw new Error(`Failed to process OSM data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private buildOverpassQuery(bbox?: BoundingBox, tags: any[] = [], timeout: number = 25): string {
    const timeoutDirective = `[timeout:${timeout}]`;
    const outputDirective = '[out:json]';

    let bboxString = '';
    if (bbox) {
      //  Overpass APIbbox: (south, west, north, east)
      bboxString = `(${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng})`;
    }

    let tagQueries: string[] = [];

    if (tags.length === 0) {
      tagQueries = [
        `way[boundary=administrative][admin_level]${bboxString};`,
        `relation[boundary=administrative][admin_level]${bboxString};`,
      ];
    } else {
      for (const tag of tags) {
        if (typeof tag === 'string' && this.tagPresets[tag]) {
          const preset = this.tagPresets[tag];
          tagQueries.push(`way${preset.query}${bboxString};`);
          tagQueries.push(`relation${preset.query}${bboxString};`);
        } else if (tag.key) {
          const tagFilter = tag.value ? `[${tag.key}=${tag.value}]` : `[${tag.key}]`;
          tagQueries.push(`way${tagFilter}${bboxString};`);
          tagQueries.push(`relation${tagFilter}${bboxString};`);

          if (tag.includeNodes) {
            tagQueries.push(`node${tagFilter}${bboxString};`);
          }
        }
      }
    }

    //  Overpass QL
    const query = `
${timeoutDirective}${outputDirective};
(
  ${tagQueries.join('\n  ')}
);
out geom;
    `.trim();

    return query;
  }

  private async executeOverpassQuery(query: string): Promise<any> {
    const url = `${this.config.access.baseUrl}${this.config.access.endpoints?.interpreter}`;

    const { authFetch } = await import('../utils/authFetch.js');
    const response = await authFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Overpass API error ${response.status}: ${errorText}`);
    }

    return await response.json();
  }

  private async convertOSMElementsToFeatures(elements: OSMElement[]): Promise<any[]> {
    const features: any[] = [];

    //  way/relation
    const nodeMap = new Map<number, OSMElement>();
    elements.forEach(element => {
      if (element.type === 'node') {
        nodeMap.set(element.id, element);
      }
    });

    for (const element of elements) {
      try {
        const feature = await this.convertElementToFeature(element, nodeMap);
        if (feature) {
          feature.osmElement = element;
          features.push(feature);
        }
      } catch (error) {
        console.warn(`Failed to convert OSM element ${element.id}:`, error);
      }
    }

    return features;
  }

  private async convertElementToFeature(element: OSMElement, nodeMap: Map<number, OSMElement>): Promise<any | null> {
    switch (element.type) {
      case 'node':
        if (element.lat !== undefined && element.lon !== undefined) {
          return {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [element.lon, element.lat],
            },
            properties: element.tags || {},
          };
        }
        break;

      case 'way':
        if (element.nodes && element.nodes.length > 0) {
          const coordinates: number[][] = [];

          for (const nodeId of element.nodes) {
            const node = nodeMap.get(nodeId);
            if (node && node.lat !== undefined && node.lon !== undefined) {
              coordinates.push([node.lon, node.lat]);
            }
          }

          if (coordinates.length > 0) {
            const isClosedWay = element.nodes[0] === element.nodes[element.nodes.length - 1];
            const geometryType = isClosedWay && coordinates.length > 3 ? 'Polygon' : 'LineString';

            return {
              type: 'Feature',
              geometry: {
                type: geometryType,
                coordinates: geometryType === 'Polygon' ? [coordinates] : coordinates,
              },
              properties: element.tags || {},
            };
          }
        }
        break;

      case 'relation':
        if (element.members) {
          //  MultiPolygon
          return {
            type: 'Feature',
            geometry: null, properties: {
              ...(element.tags || {}),
              osmType: 'relation',
              memberCount: element.members.length,
            },
          };
        }
        break;
    }

    return null;
  }

  private generateEntityId(element: OSMElement): string {
    return `osm-${element.type}-${element.id}`;
  }

  private generateNodeId(element: OSMElement): string {
    return `node-osm-${element.type}-${element.id}`;
  }

  private extractName(element: OSMElement): string {
    const tags = element.tags || {};

    const nameKeys = ['name:en', 'name', 'name:local', 'ref', 'alt_name'];

    for (const key of nameKeys) {
      if (tags[key]) {
        return tags[key];
      }
    }

    const type = tags.place || tags.boundary || tags.natural || tags.highway || tags.waterway || element.type;
    return `${type} ${element.id}`;
  }

  private extractDescription(element: OSMElement): string | undefined {
    const tags = element.tags || {};
    const parts: string[] = [];

    //  OSM
    parts.push(`OSM ${element.type} #${element.id}`);

    const importantTags = ['place', 'boundary', 'admin_level', 'natural', 'highway', 'waterway', 'landuse'];
    for (const tagKey of importantTags) {
      if (tags[tagKey]) {
        parts.push(`${tagKey}: ${tags[tagKey]}`);
      }
    }

    if (tags.wikipedia) {
      parts.push(`Wikipedia: ${tags.wikipedia}`);
    }

    return parts.length > 1 ? parts.join(', ') : undefined;
  }

  getAvailablePresets(): Record<string, any> {
    return { ...this.tagPresets };
  }

  buildPresetQuery(presetName: string, bbox?: BoundingBox, timeout: number = 25): string {
    if (!this.tagPresets[presetName]) {
      throw new Error(`Unknown preset: ${presetName}`);
    }

    return this.buildOverpassQuery(bbox, [presetName], timeout);
  }
}
