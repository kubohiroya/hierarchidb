// ============================================================
// Core vector tile generation from a FeatureCollection.
// ============================================================

import type { Tile } from 'geojson-vt';
import type { Feature, Geometry, GeoJsonProperties } from 'geojson';
import type { FeatureMetadataRow } from '@hierarchidb/vectortile-store';
import type { NodeId } from '@hierarchidb/core-types';
import { encodeMvtFromGeojsonVt } from '../vectorTileFormats.js';
import {
    pickAdminCode,
    pickAdminLevel,
    pickAdminName,
    pickCountryCode,
    pickCountryName,
} from '../vectorTileUtils.js';
import type {
    FeatureCollectionLike,
    GeojsonVtData,
    VTGenerateConfig,
    VTGenerateResult,
    VectorTileProgress,
    VectorTileRow,
} from './types.js';
import {
    buildUniqueFeatureId,
    ensureMetadataProperties,
    extractGeometryStats,
    lat2tile,
    loadGeojsonVt,
    long2tile,
    resolveTileLayerName,
    throwIfAborted,
    updateBbox,
} from './utils.js';

type FeatureLike = Feature<Geometry, GeoJsonProperties>;

export const generateVectorTilesFromFeatureCollection = async (
    nodeId: NodeId,
    geojson: FeatureCollectionLike,
    config: VTGenerateConfig,
    onProgress?: (progress: VectorTileProgress) => void,
): Promise<VTGenerateResult> => {
    const startedAt = Date.now();
    throwIfAborted(config.signal);
    const features = geojson.features ?? [];
    if (features.length === 0) return { tilesGenerated: 0, totalBytes: 0, tiles: [] };

    const metadataEnabled = Boolean(config.metadataEnabled);
    const metadataContext = config.metadataContext ?? {};
    const geometryEngine = config.geometryEngine ?? 'turf';
    const createdAt = Date.now();
    let metadataCount: number | undefined;
    let featureMetadata: FeatureMetadataRow[] | undefined;

    const metaStart = Date.now();
    if (metadataEnabled) {
        const records: FeatureMetadataRow[] = [];
        for (let index = 0; index < features.length; index++) {
            throwIfAborted(config.signal);
            const feature = features[index];
            if (!feature) continue;
            feature.properties = feature.properties ?? {};
            const properties = feature.properties;
            const tileFeatureId = buildUniqueFeatureId(feature, index, metadataContext);
            properties.id = tileFeatureId;
            ensureMetadataProperties(properties, metadataContext);
            const stats = extractGeometryStats(feature.geometry, geometryEngine);
            const countryName = metadataContext.countryName ?? pickCountryName(properties);
            const countryCode = metadataContext.countryCode ?? pickCountryCode(properties);
            const adminLevel = metadataContext.adminLevel ?? pickAdminLevel(properties);
            const adminName = pickAdminName(properties);
            const adminCode = pickAdminCode(properties);
            let admin1Name: string | undefined;
            let admin1Code: string | undefined;
            let admin2Name: string | undefined;
            let admin2Code: string | undefined;
            if (adminLevel === 1) {
                admin1Name = adminName;
                admin1Code = adminCode;
            } else if (adminLevel === 2) {
                admin2Name = adminName;
                admin2Code = adminCode;
            }
            records.push({
                id: `${nodeId}-${tileFeatureId}`,
                nodeId,
                featureId: tileFeatureId,
                countryName,
                countryCode,
                adminLevel,
                admin0Name: countryName,
                admin0Code: countryCode,
                admin1Name,
                admin1Code,
                admin2Name,
                admin2Code,
                dataSource: metadataContext.dataSource,
                createdAt,
                vertexCount: stats.vertexCount,
                polygonCount: stats.polygonCount,
                bbox: stats.bbox,
                area: stats.area,
            });
        }
        featureMetadata = records;
        metadataCount = records.length;
    } else {
        for (let index = 0; index < features.length; index++) {
            throwIfAborted(config.signal);
            const feature = features[index];
            if (!feature) continue;
            const properties = feature.properties ?? {};
            properties.id = buildUniqueFeatureId(feature, index, metadataContext);
            ensureMetadataProperties(properties, metadataContext);
        }
    }
    console.debug('[VectorTiles] metadata pass', {
        nodeId,
        features: features.length,
        metadataEnabled,
        ms: Date.now() - metaStart,
    });

    const moduleStart = Date.now();
    const geojsonvt = await loadGeojsonVt();
    console.debug('[VectorTiles] modules loaded', { ms: Date.now() - moduleStart });
    const extent = 4096;
    const bufferValue = typeof config.buffer === 'number' ? config.buffer : 64;
    const fallbackMaxZoom = 6;
    const resolvedMinZoom = Number.isFinite(config.minZoom) ? Number(config.minZoom) : 0;
    const resolvedMaxZoom = Number.isFinite(config.maxZoom) ? Number(config.maxZoom) : fallbackMaxZoom;
    const zoomMin = Math.min(resolvedMinZoom, resolvedMaxZoom);
    const zoomMax = Math.max(resolvedMinZoom, resolvedMaxZoom);
    const targetZooms = Array.from({ length: zoomMax - zoomMin + 1 }, (_, z) => zoomMin + z);
    const indexMaxZoom = targetZooms.length > 0 ? Math.max(...targetZooms) : fallbackMaxZoom;
    const indexStart = Date.now();
    const fallbackLayerAdminLevel = typeof metadataContext.adminLevel === 'number' ? metadataContext.adminLevel : undefined;
    const featureGroups = new Map<string, FeatureLike[]>();
    for (const feature of features) {
        const layerName = resolveTileLayerName(feature, fallbackLayerAdminLevel);
        const list = featureGroups.get(layerName);
        if (list) {
            list.push(feature);
        } else {
            featureGroups.set(layerName, [feature]);
        }
    }
    const indexedLayers = new Map<string, ReturnType<typeof geojsonvt>>();
    featureGroups.forEach((layerFeatures, layerName) => {
        const groupedCollection = { type: 'FeatureCollection', features: layerFeatures };
        indexedLayers.set(
            layerName,
            geojsonvt(groupedCollection as GeojsonVtData, {
                maxZoom: indexMaxZoom,
                extent,
                buffer: bufferValue,
                indexMaxZoom,
                promoteId: 'id',
                indexMaxPoints: 100000,
            }),
        );
    });
    throwIfAborted(config.signal);
    console.debug('[VectorTiles] index built', { ms: Date.now() - indexStart });

    const bboxStart = Date.now();
    const bbox: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const feature of features) {
        throwIfAborted(config.signal);
        const stats = extractGeometryStats(feature?.geometry, geometryEngine);
        if (!stats.bbox) continue;
        updateBbox(bbox, [stats.bbox[0], stats.bbox[1]]);
        updateBbox(bbox, [stats.bbox[2], stats.bbox[3]]);
    }
    console.debug('[VectorTiles] bbox computed', { ms: Date.now() - bboxStart });
    if (!bbox.every((value) => Number.isFinite(value))) {
        return { tilesGenerated: 0, totalBytes: 0, tiles: [] };
    }
    const [minLon, minLat, maxLon, maxLat] = bbox;

    const tileRanges = targetZooms.map((z) => {
        const x1 = long2tile(minLon, z);
        const x2 = long2tile(maxLon, z);
        const y1 = lat2tile(maxLat, z);
        const y2 = lat2tile(minLat, z);
        const count = Math.max(0, (x2 - x1 + 1) * (y2 - y1 + 1));
        return { z, x1, x2, y1, y2, count };
    });
    const totalTiles = tileRanges.reduce((sum, range) => sum + range.count, 0);
    let processedTiles = 0;
    let lastPercent = -1;
    let lastUpdateAt = 0;
    const reportProgress = (z: number, x: number, y: number) => {
        if (!onProgress || totalTiles <= 0) return;
        processedTiles += 1;
        const percent = Math.min(100, (processedTiles / totalTiles) * 100);
        const now = Date.now();
        if (processedTiles === totalTiles || percent - lastPercent >= 1 || now - lastUpdateAt >= 750) {
            lastPercent = percent;
            lastUpdateAt = now;
            onProgress({ total: totalTiles, completed: processedTiles, percent, zoom: z, x, y });
        }
    };

    const tiles: VectorTileRow[] = [];
    let tilesGenerated = 0;
    let totalBytes = 0;
    let tilesWithFeatures = 0;
    let tilesWithoutFeatures = 0;
    const tileStart = Date.now();
    for (const range of tileRanges) {
        const { z, x1, x2, y1, y2 } = range;
        throwIfAborted(config.signal);
        for (let x = x1; x <= x2; x++) {
            throwIfAborted(config.signal);
            for (let y = y1; y <= y2; y++) {
                throwIfAborted(config.signal);
                const layers: Record<string, Tile> = {};
                indexedLayers.forEach((layerIndex, layerName) => {
                    const tile = layerIndex.getTile(z, x, y);
                    const matchedLayer =
                        tile && Array.isArray((tile as { features?: unknown[] }).features)
                            ? (tile as Tile)
                            : null;
                    if (matchedLayer?.features?.length) {
                        layers[layerName] = matchedLayer;
                    }
                });
                if (Object.keys(layers).length > 0) {
                    const pbf = await encodeMvtFromGeojsonVt(layers, {
                        version: 2,
                    });
                    const bytes = pbf;
                    tilesGenerated++;
                    tilesWithFeatures++;
                    totalBytes += bytes.byteLength;
                    tiles.push({
                        z,
                        x,
                        y,
                        data: bytes,
                        size: bytes.byteLength,
                        contentType: 'application/vnd.mapbox-vector-tile',
                        timestamp: Date.now(),
                    });
                } else {
                    tilesWithoutFeatures++;
                }
                reportProgress(z, x, y);
            }
        }
    }
    console.debug('[VectorTiles] tiles built', {
        nodeId,
        tilesGenerated,
        totalTiles,
        ms: Date.now() - tileStart,
    });

    if (tilesWithoutFeatures > 0) {
        console.debug('[VectorTiles] Feature reduction summary', {
            nodeId,
            inputFeatures: features.length,
            tileCandidates: totalTiles,
            tilesWithFeatures,
            tilesWithoutFeatures,
        });
    }
    console.debug('[VectorTiles] total', { nodeId, ms: Date.now() - startedAt });
    return { tilesGenerated, totalBytes, metadataCount, tiles, featureMetadata };
};
