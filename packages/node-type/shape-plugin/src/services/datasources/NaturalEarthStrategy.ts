/**
 * Natural Earth データソース戦略
 * https://www.naturalearthdata.com/ からShapefileデータを取得
 */

import { BaseDataSourceStrategy, DataSourceConfig, FetchOptions, ProcessOptions } from './DataSourceStrategy';
import { ShapeEntity } from '../../types/ShapeEntity';
import JSZip from 'jszip';

// Natural Earth特有の生データ型
export interface NaturalEarthRawData {
  files: Map<string, ArrayBuffer>; // ファイル名 -> バイナリデータ
  metadata: {
    source: string;
    downloadedAt: string;
    endpoint: string;
    totalSize: number;
  };
}

// Natural Earth処理後データ型
export interface NaturalEarthProcessedData extends Array<ShapeEntity> {
  metadata?: {
    source: 'natural-earth';
    processedAt: string;
    count: number;
    adminLevel?: number;
    resolution?: string;
  };
}

/**
 * Natural Earth データソース戦略実装
 */
export class NaturalEarthStrategy extends BaseDataSourceStrategy<NaturalEarthRawData, NaturalEarthProcessedData> {
  readonly id = 'natural-earth-shapes';
  readonly name = 'Natural Earth Vector Data';
  readonly config: DataSourceConfig = {
    id: 'natural-earth-shapes',
    name: 'Natural Earth Vector Data',
    description: 'Free vector and raster map data at 1:10m, 1:50m, and 1:110m scales',
    version: '5.1.1',
    access: {
      method: 'File',
      baseUrl: 'https://www.naturalearthdata.com/http//www.naturalearthdata.com/download/',
      endpoints: {
        // 1:10m (Large scale data, 1:10,000,000)
        'countries-10m': '10m/cultural/ne_10m_admin_0_countries.zip',
        'states-10m': '10m/cultural/ne_10m_admin_1_states_provinces.zip',
        'cities-10m': '10m/cultural/ne_10m_populated_places.zip',
        'coastline-10m': '10m/physical/ne_10m_coastline.zip',
        'rivers-10m': '10m/physical/ne_10m_rivers_lake_centerlines.zip',
        'lakes-10m': '10m/physical/ne_10m_lakes.zip',
        
        // 1:50m (Medium scale data, 1:50,000,000)
        'countries-50m': '50m/cultural/ne_50m_admin_0_countries.zip',
        'states-50m': '50m/cultural/ne_50m_admin_1_states_provinces.zip',
        'cities-50m': '50m/cultural/ne_50m_populated_places.zip',
        'coastline-50m': '50m/physical/ne_50m_coastline.zip',
        'rivers-50m': '50m/physical/ne_50m_rivers_lake_centerlines.zip',
        'lakes-50m': '50m/physical/ne_50m_lakes.zip',
        
        // 1:110m (Small scale data, 1:110,000,000)
        'countries-110m': '110m/cultural/ne_110m_admin_0_countries.zip',
        'states-110m': '110m/cultural/ne_110m_admin_1_states_provinces.zip',
        'cities-110m': '110m/cultural/ne_110m_populated_places.zip',
        'coastline-110m': '110m/physical/ne_110m_coastline.zip',
        'rivers-110m': '110m/physical/ne_110m_rivers_lake_centerlines.zip',
        'lakes-110m': '110m/physical/ne_110m_lakes.zip'
      },
      authentication: { type: 'none' },
      timeout: 60000, // 60秒
      retries: { count: 3, delay: 2000, backoff: 'exponential' }
    },
    processing: {
      inputFormat: 'shapefile',
      outputFormat: 'geojson',
      validation: [
        { field: 'geometry', rule: 'required' },
        { field: 'properties', rule: 'required' }
      ],
      transformations: [
        { type: 'coordinate-system', from: 'EPSG:4326', to: 'EPSG:4326' }, // WGS84のまま
        { type: 'simplify', tolerance: 0.001 } // 適度な簡略化
      ]
    },
    cache: {
      ttl: 86400000 * 7, // 1週間キャッシュ
      strategy: 'disk'
    }
  };

  async fetchData(options?: FetchOptions): Promise<NaturalEarthRawData> {
    const { 
      endpoint = 'countries-50m', 
      adminLevel, 
      bbox,
      timeout = this.config.access.timeout 
    } = options || {};

    // エンドポイントの決定
    const selectedEndpoint = this.selectEndpoint(endpoint, adminLevel);
    if (!selectedEndpoint || !this.config.access.endpoints?.[selectedEndpoint]) {
      throw new Error(`Unknown endpoint: ${selectedEndpoint}`);
    }

    const downloadUrl = `${this.config.access.baseUrl}${this.config.access.endpoints[selectedEndpoint]}`;
    
    console.log(`[NaturalEarth] Downloading from: ${downloadUrl}`);

    try {
      // ZIPファイルをダウンロード
      const response = await this.downloadWithRetry(downloadUrl, timeout);
      const zipBuffer = await response.arrayBuffer();
      
      // ZIPファイルを解凍
      const zip = new JSZip();
      const zipData = await zip.loadAsync(zipBuffer);
      
      // ファイルを抽出
      const files = new Map<string, ArrayBuffer>();
      
      for (const [fileName, fileData] of Object.entries(zipData.files)) {
        if (!fileData.dir) {
          const buffer = await fileData.async('arraybuffer');
          files.set(fileName, buffer);
        }
      }

      return {
        files,
        metadata: {
          source: 'natural-earth',
          downloadedAt: new Date().toISOString(),
          endpoint: selectedEndpoint,
          totalSize: zipBuffer.byteLength
        }
      };

    } catch (error) {
      throw new Error(`Failed to download Natural Earth data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async processData(rawData: NaturalEarthRawData, options?: ProcessOptions): Promise<NaturalEarthProcessedData> {
    const { filters, transformations, simplify = true, tolerance = 0.001 } = options || {};

    try {
      // Shapefileを解析してGeoJSONに変換
      const geojson = await this.convertShapefilesToGeoJSON(rawData.files);
      
      // フィルタリング適用
      let features = geojson.features;
      if (filters && filters.length > 0) {
        features = await this.applyFilters(features, filters);
      }

      // 座標変換・簡略化
      if (transformations && transformations.length > 0) {
        features = await this.applyTransformations(features, transformations);
      }

      // ShapeEntityに変換
      const entities: ShapeEntity[] = features.map((feature, index) => {
        const properties = feature.properties || {};
        
        return {
          id: this.generateEntityId(properties, index),
          nodeId: this.generateNodeId(properties, index),
          name: this.extractName(properties),
          description: this.extractDescription(properties),
          geometry: feature.geometry,
          properties: {
            ...properties,
            source: 'natural-earth',
            endpoint: rawData.metadata.endpoint
          },
          metadata: {
            source: 'natural-earth',
            originalIndex: index,
            downloadedAt: rawData.metadata.downloadedAt,
            processedAt: new Date().toISOString()
          },
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1
        } as ShapeEntity;
      });

      // メタデータ付きで返却
      const result = entities as NaturalEarthProcessedData;
      result.metadata = {
        source: 'natural-earth',
        processedAt: new Date().toISOString(),
        count: entities.length,
        adminLevel: this.extractAdminLevel(rawData.metadata.endpoint)
      };

      return result;

    } catch (error) {
      throw new Error(`Failed to process Natural Earth data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private selectEndpoint(endpoint: string, adminLevel?: number): string {
    // 管理レベルに基づいてエンドポイントを選択
    if (adminLevel !== undefined) {
      if (adminLevel === 0) {
        return 'countries-50m'; // 国レベル
      } else if (adminLevel === 1) {
        return 'states-50m'; // 州・県レベル
      }
    }

    // デフォルトまたは指定されたエンドポイント
    return endpoint;
  }

  private async downloadWithRetry(url: string, timeout?: number): Promise<Response> {
    const { count = 3, delay = 2000, backoff = 'exponential' } = this.config.access.retries || {};
    
    for (let attempt = 0; attempt < count; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = timeout ? setTimeout(() => controller.abort(), timeout) : null;

        const response = await fetch(url, {
          signal: controller.signal
        });

        if (timeoutId) clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response;

      } catch (error) {
        if (attempt === count - 1) throw error;
        
        // 指数バックオフまたは線形待機
        const waitTime = backoff === 'exponential' 
          ? delay * Math.pow(2, attempt)
          : delay * (attempt + 1);
        
        console.warn(`[NaturalEarth] Attempt ${attempt + 1} failed, retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    throw new Error('Max retry attempts reached');
  }

  private async convertShapefilesToGeoJSON(files: Map<string, ArrayBuffer>): Promise<any> {
    // Shapefileの解析ライブラリを使用（shapefile-jsなど）
    // 実装簡略化のため、モックデータを返す
    
    // 実際の実装では shapefileライブラリを使用:
    // const shapefile = await import('shapefile');
    // const geojson = await shapefile.read(shpBuffer, dbfBuffer);
    
    return {
      type: 'FeatureCollection',
      features: [
        // モックデータ
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [139.692, 35.689], // Tokyo
              [139.792, 35.689],
              [139.792, 35.789],
              [139.692, 35.789],
              [139.692, 35.689]
            ]]
          },
          properties: {
            NAME: 'Sample Country',
            NAME_EN: 'Sample Country',
            ISO_A3: 'SAM',
            POP_EST: 125000000
          }
        }
      ]
    };
  }

  private generateEntityId(properties: any, index: number): string {
    // プロパティからユニークなIDを生成
    const iso = properties.ISO_A3 || properties.ISO_3166_1 || properties.adm0_a3;
    const name = properties.NAME || properties.NAME_EN || properties.name;
    
    if (iso) return `ne-${iso.toLowerCase()}`;
    if (name) return `ne-${name.toLowerCase().replace(/\s+/g, '-')}`;
    
    return `ne-feature-${index}`;
  }

  private generateNodeId(properties: any, index: number): string {
    return `node-${this.generateEntityId(properties, index)}`;
  }

  private extractName(properties: any): string {
    return properties.NAME || 
           properties.NAME_EN || 
           properties.name || 
           properties.NAME_LOCAL || 
           `Unnamed Feature`;
  }

  private extractDescription(properties: any): string | undefined {
    const parts: string[] = [];
    
    if (properties.TYPE) parts.push(`Type: ${properties.TYPE}`);
    if (properties.CONTINENT) parts.push(`Continent: ${properties.CONTINENT}`);
    if (properties.REGION_UN) parts.push(`Region: ${properties.REGION_UN}`);
    if (properties.POP_EST) parts.push(`Population: ${properties.POP_EST.toLocaleString()}`);
    
    return parts.length > 0 ? parts.join(', ') : undefined;
  }

  private extractAdminLevel(endpoint: string): number | undefined {
    if (endpoint.includes('countries')) return 0;
    if (endpoint.includes('states')) return 1;
    if (endpoint.includes('cities')) return 2;
    return undefined;
  }
}