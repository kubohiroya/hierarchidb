/**
 * Feature type conversion utilities
 * Handles conversion between internal Feature type and GeoJSON standard Feature
 */

import type { Feature as GeoJSONFeature, Geometry } from "geojson";
import type { NodeId } from "@hierarchidb/common-core";
import type { Feature } from "../types";

/**
 * Convert internal Feature to GeoJSON standard Feature
 * Used when passing to turf.js or MapLibre GL JS
 *
 * Handles the dual ID system:
 * - Uses originalId if available (preserves external source ID)
 * - Falls back to internal id if no originalId exists
 */
export function toGeoJSONFeature(feature: Feature): GeoJSONFeature {
  const geoJsonFeature: GeoJSONFeature = {
    type: feature.type,
    // Use originalId if available, otherwise use internal id
    id: feature.originalId ?? feature.id,
    geometry: feature.geometry,
    properties: {
      ...feature.properties,
      // Include system properties in properties object
      _internalId: feature.id, // Preserve internal ID in properties
      nodeId: feature.nodeId,
      adminLevel: feature.adminLevel,
      countryCode: feature.countryCode,
      name: feature.name,
      nameEn: feature.nameEn,
      population: feature.population,
      area: feature.area,
      mortonCode: feature.mortonCode?.toString(), // Convert bigint to string for JSON compatibility
    },
  };

  if (feature.bbox) {
    geoJsonFeature.bbox = feature.bbox;
  }

  return geoJsonFeature;
}

/**
 * Convert GeoJSON Feature to internal Feature type
 * Used when storing data from external sources
 *
 * Handles the dual ID system:
 * - Preserves original GeoJSON id as originalId
 * - Generates new internal id for DB (will be replaced by auto-increment)
 */
export function fromGeoJSONFeature(
  geojson: GeoJSONFeature,
  nodeId: NodeId,
  additionalData?: Partial<Feature>,
): Feature {
  // Check if this feature already has an internal ID (from previous conversion)
  const internalId = geojson.properties?._internalId;

  return {
    type: "Feature",
    // Internal ID: use existing internal ID or 0 (will be auto-output by Dexie)
    id: typeof internalId === "number" ? internalId : 0,
    // Preserve original GeoJSON id
    originalId: geojson.id,
    nodeId,
    geometry: geojson.geometry,
    properties: geojson.properties || {},
    bbox: geojson.bbox,
    // Extract system properties from properties if they exist
    adminLevel: geojson.properties?.adminLevel,
    countryCode: geojson.properties?.countryCode,
    name: geojson.properties?.name,
    nameEn: geojson.properties?.nameEn,
    population: geojson.properties?.population,
    area: geojson.properties?.area,
    mortonCode: geojson.properties?.mortonCode
      ? BigInt(geojson.properties.mortonCode)
      : undefined,
    // Apply any additional data
    ...additionalData,
  };
}

/**
 * Check if a Feature has valid GeoJSON geometry
 */
export function hasValidGeometry(feature: Feature): boolean {
  if (!feature.geometry) return false;

  const validTypes = [
    "Point",
    "LineString",
    "Polygon",
    "MultiPoint",
    "MultiLineString",
    "MultiPolygon",
    "GeometryCollection",
  ];

  return validTypes.includes(feature.geometry.type);
}

/**
 * Create a minimal GeoJSON Feature from geometry
 */
export function createFeatureFromGeometry(
  geometry: Geometry,
  properties: Record<string, any> = {},
): GeoJSONFeature {
  return {
    type: "Feature",
    geometry,
    properties,
  };
}
