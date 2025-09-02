/**
 * GeoBoundaries データソース戦略
 * https://www.geoboundaries.org/ から行政区域境界データを取得
 */

import { BaseDataSourceStrategy, DataSourceConfig, FetchOptions, ProcessOptions } from './DataSourceStrategy';
import { ShapeEntity } from '../../types/ShapeEntity';

// GeoBoundaries特有の生データ型
export interface GeoBoundariesRawData {
  geojson?: any;
  shapefile?: Map<string, ArrayBuffer>;
  metadata: {
    source: 'geoboundaries';
    downloadedAt: string;
    country: string;
    adminLevel: string;
    releaseType: 'gbOpen' | 'gbHumanitarian' | 'gbAuthoritative';
    version: string;
    format: 'geojson' | 'shapefile' | 'kml' | 'topojson';
    apiResponse?: any;
  };
}

// GeoBoundaries処理後データ型
export interface GeoBoundariesProcessedData extends Array<ShapeEntity> {
  metadata?: {
    source: 'geoboundaries';
    processedAt: string;
    count: number;
    country: string;
    adminLevel: string;
    releaseType: string;
    version: string;
    license?: string;
  };
}

/**
 * GeoBoundaries データソース戦略実装
 */
export class GeoBoundariesStrategy extends BaseDataSourceStrategy<GeoBoundariesRawData, GeoBoundariesProcessedData> {
  readonly id = 'geoboundaries-admin-areas';
  readonly name = 'GeoBoundaries Administrative Areas';
  readonly config: DataSourceConfig = {
    id: 'geoboundaries-admin-areas',
    name: 'GeoBoundaries Global Administrative Areas',
    description: 'Open, free, and research-ready administrative boundaries',
    version: '5.0.0',
    access: {
      method: 'REST',
      baseUrl: 'https://www.geoboundaries.org/api/current/',
      endpoints: {
        // API v1エンドポイント
        single: 'gbOpen/{ISO}/{ADM}/',
        humanitarian: 'gbHumanitarian/{ISO}/{ADM}/',
        authoritative: 'gbAuthoritative/{ISO}/{ADM}/',
        
        // 検索・一覧エンドポイント
        available: 'available/',
        search: 'search/',
        
        // 統計情報
        metadata: 'metadata/{ISO}/{ADM}/'
      },
      authentication: { type: 'none' },
      timeout: 60000, // 60秒
      retries: { count: 3, delay: 2000, backoff: 'exponential' }
    },
    processing: {
      inputFormat: 'geojson',
      outputFormat: 'geojson',
      validation: [
        { field: 'geometry', rule: 'required' },
        { field: 'properties', rule: 'required' },
        { field: 'properties.shapeName', rule: 'required' }
      ],
      transformations: [
        { type: 'coordinate-system', from: 'EPSG:4326', to: 'EPSG:4326' }
      ]
    },
    cache: {
      ttl: 86400000 * 7, // 1週間キャッシュ
      strategy: 'disk'
    }
  };

  // 管理レベルマッピング
  private readonly adminLevels: Record<string, string> = {
    'country': 'ADM0',
    'state': 'ADM1', 
    'county': 'ADM2',
    'municipality': 'ADM3',
    'ward': 'ADM4',
    'neighborhood': 'ADM5',
    '0': 'ADM0',
    '1': 'ADM1',
    '2': 'ADM2',
    '3': 'ADM3',
    '4': 'ADM4',
    '5': 'ADM5'
  };

  // リリースタイプの優先順位
  private readonly releaseTypePriority: ('gbOpen' | 'gbHumanitarian' | 'gbAuthoritative')[] = [
    'gbAuthoritative', // 最も信頼性の高いデータ
    'gbHumanitarian',  // 人道支援用データ
    'gbOpen'           // 一般的なオープンデータ
  ];

  async fetchData(options?: FetchOptions): Promise<GeoBoundariesRawData> {
    const { 
      country = 'USA',
      adminLevel = '1',
      endpoint,
      timeout = this.config.access.timeout
    } = options || {};

    // 国コードとadminレベルを正規化
    const normalizedCountry = this.normalizeCountryCode(country);
    const normalizedAdminLevel = this.normalizeAdminLevel(adminLevel.toString());
    
    try {
      // APIメタデータを取得してダウンロードURLを取得
      const apiData = await this.fetchBoundaryMetadata(normalizedCountry, normalizedAdminLevel, endpoint);
      
      if (!apiData || !apiData.gjDownloadURL) {
        throw new Error(`No boundary data available for ${normalizedCountry} ${normalizedAdminLevel}`);
      }

      console.log(`[GeoBoundaries] Downloading ${apiData.releaseType} data for ${normalizedCountry} ${normalizedAdminLevel}`);
      console.log(`[GeoBoundaries] URL: ${apiData.gjDownloadURL}`);

      // GeoJSONファイルをダウンロード
      const response = await this.downloadWithRetry(apiData.gjDownloadURL, timeout);
      const geojson = await response.json();

      return {
        geojson,
        metadata: {
          source: 'geoboundaries',
          downloadedAt: new Date().toISOString(),
          country: normalizedCountry,
          adminLevel: normalizedAdminLevel,
          releaseType: apiData.releaseType || 'gbOpen',
          version: apiData.boundaryYear || '2023',
          format: 'geojson',
          apiResponse: apiData
        }
      };

    } catch (error) {
      throw new Error(`Failed to fetch GeoBoundaries data for ${normalizedCountry} ${normalizedAdminLevel}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async processData(rawData: GeoBoundariesRawData, options?: ProcessOptions): Promise<GeoBoundariesProcessedData> {
    const { filters, transformations } = options || {};

    try {
      if (!rawData.geojson || !rawData.geojson.features) {
        throw new Error('Invalid GeoJSON data');
      }

      let features = rawData.geojson.features;

      // フィルタリング適用
      if (filters && filters.length > 0) {
        features = await this.applyFilters(features, filters);
      }

      // 変換適用
      if (transformations && transformations.length > 0) {
        features = await this.applyTransformations(features, transformations);
      }

      // ShapeEntityに変換
      const entities: ShapeEntity[] = features.map((feature: any, index: number) => {
        const properties = feature.properties || {};
        
        return {
          id: this.generateEntityId(properties, index),
          nodeId: this.generateNodeId(properties, index),
          name: this.extractName(properties),
          description: this.extractDescription(properties, rawData.metadata),
          geometry: feature.geometry,
          properties: {
            ...properties,
            source: 'geoboundaries',
            country: rawData.metadata.country,
            adminLevel: rawData.metadata.adminLevel,
            releaseType: rawData.metadata.releaseType,
            boundaryYear: rawData.metadata.version
          },
          metadata: {
            source: 'geoboundaries',
            originalIndex: index,
            downloadedAt: rawData.metadata.downloadedAt,
            processedAt: new Date().toISOString(),
            geoboundariesVersion: rawData.metadata.version,
            license: rawData.metadata.apiResponse?.licenseDetail || 'Open Data'
          },
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1
        } as ShapeEntity;
      });

      // メタデータ付きで返却
      const result = entities as GeoBoundariesProcessedData;
      result.metadata = {
        source: 'geoboundaries',
        processedAt: new Date().toISOString(),
        count: entities.length,
        country: rawData.metadata.country,
        adminLevel: rawData.metadata.adminLevel,
        releaseType: rawData.metadata.releaseType,
        version: rawData.metadata.version,
        license: rawData.metadata.apiResponse?.licenseDetail || 'Open Data'
      };

      return result;

    } catch (error) {
      throw new Error(`Failed to process GeoBoundaries data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async fetchBoundaryMetadata(country: string, adminLevel: string, preferredEndpoint?: string): Promise<any> {
    // リリースタイプを決定
    const releaseTypes = preferredEndpoint 
      ? [preferredEndpoint as 'gbOpen' | 'gbHumanitarian' | 'gbAuthoritative']
      : this.releaseTypePriority;

    // 各リリースタイプを順番に試す
    for (const releaseType of releaseTypes) {
      try {
        const endpoint = this.config.access.endpoints?.[releaseType];
        if (!endpoint) continue;

        const url = `${this.config.access.baseUrl}${endpoint.replace('{ISO}', country).replace('{ADM}', adminLevel)}`;
        
        console.log(`[GeoBoundaries] Trying ${releaseType}: ${url}`);
        
        const { authFetch } = await import('../utils/authFetch');
        const response = await authFetch(url);
        
        if (response.ok) {
          const data = await response.json();
          data.releaseType = releaseType;
          return data;
        } else if (response.status === 404) {
          console.warn(`[GeoBoundaries] ${releaseType} not available for ${country} ${adminLevel}`);
          continue; // 次のリリースタイプを試す
        } else {
          throw new Error(`API error ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        console.warn(`[GeoBoundaries] Failed to fetch ${releaseType}:`, error);
        continue;
      }
    }

    throw new Error(`No boundary data found for ${country} ${adminLevel} in any release type`);
  }

  private normalizeCountryCode(country: string): string {
    // ISO 3166-1 alpha-3 コードに変換
    const upperCountry = country.toUpperCase();
    
    // すでにISO 3166-1 alpha-3形式の場合
    if (upperCountry.length === 3) {
      return upperCountry;
    }

    // よく使用される国名/コードのマッピング
    const countryMappings: Record<string, string> = {
      'UNITED STATES': 'USA',
      'US': 'USA',
      'UNITED KINGDOM': 'GBR',
      'UK': 'GBR',
      'GREAT BRITAIN': 'GBR',
      'JAPAN': 'JPN',
      'JP': 'JPN',
      'GERMANY': 'DEU',
      'DE': 'DEU',
      'FRANCE': 'FRA',
      'FR': 'FRA',
      'ITALY': 'ITA',
      'IT': 'ITA',
      'SPAIN': 'ESP',
      'ES': 'ESP',
      'CANADA': 'CAN',
      'CA': 'CAN',
      'AUSTRALIA': 'AUS',
      'AU': 'AUS',
      'BRAZIL': 'BRA',
      'BR': 'BRA',
      'CHINA': 'CHN',
      'CN': 'CHN',
      'INDIA': 'IND',
      'IN': 'IND',
      'RUSSIA': 'RUS',
      'RU': 'RUS'
    };

    return countryMappings[upperCountry] || upperCountry.substring(0, 3);
  }

  private normalizeAdminLevel(adminLevel: string): string {
    const normalized = this.adminLevels[adminLevel.toLowerCase()];
    return normalized || `ADM${Math.min(Math.max(parseInt(adminLevel) || 0, 0), 5)}`;
  }

  private async downloadWithRetry(url: string, timeout?: number): Promise<Response> {
    const { count = 3, delay = 2000, backoff = 'exponential' } = this.config.access.retries || {};
    
    for (let attempt = 0; attempt < count; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = timeout ? setTimeout(() => controller.abort(), timeout) : null;

        const { authFetch } = await import('../utils/authFetch');
        const response = await authFetch(url, {
          signal: controller.signal
        });

        if (timeoutId) clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response;

      } catch (error) {
        if (attempt === count - 1) throw error;
        
        const waitTime = backoff === 'exponential' 
          ? delay * Math.pow(2, attempt)
          : delay * (attempt + 1);
        
        console.warn(`[GeoBoundaries] Attempt ${attempt + 1} failed, retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    throw new Error('Max retry attempts reached');
  }

  private generateEntityId(properties: any, index: number): string {
    // GeoBoundariesの固有IDを使用
    const shapeID = properties.shapeID;
    const shapeGroup = properties.shapeGroup;
    const shapeName = properties.shapeName;
    
    if (shapeID) {
      return `gb-${shapeID}`;
    } else if (shapeGroup && shapeName) {
      return `gb-${shapeGroup}-${shapeName.toLowerCase().replace(/\s+/g, '-')}`;
    } else if (shapeName) {
      return `gb-${shapeName.toLowerCase().replace(/\s+/g, '-')}`;
    }
    
    return `gb-feature-${index}`;
  }

  private generateNodeId(properties: any, index: number): string {
    return `node-${this.generateEntityId(properties, index)}`;
  }

  private extractName(properties: any): string {
    return properties.shapeName || 
           properties.NAME || 
           properties.name || 
           'Unnamed Administrative Area';
  }

  private extractDescription(properties: any, metadata: any): string | undefined {
    const parts: string[] = [];
    
    // 基本情報
    parts.push(`Administrative Level: ${metadata.adminLevel}`);
    parts.push(`Country: ${metadata.country}`);
    parts.push(`Release Type: ${metadata.releaseType}`);
    
    // 境界の年度情報
    if (metadata.version) {
      parts.push(`Boundary Year: ${metadata.version}`);
    }
    
    // GeoBoundaries固有の情報
    if (properties.shapeGroup) {
      parts.push(`Shape Group: ${properties.shapeGroup}`);
    }
    
    if (properties.shapeType) {
      parts.push(`Shape Type: ${properties.shapeType}`);
    }

    // ライセンス情報
    if (metadata.apiResponse?.licenseDetail) {
      parts.push(`License: ${metadata.apiResponse.licenseDetail}`);
    }
    
    return parts.length > 0 ? parts.join(', ') : undefined;
  }

  // 利用可能な国と管理レベルを取得するヘルパーメソッド
  async getAvailableCountries(): Promise<string[]> {
    try {
      const { authFetch } = await import('../utils/authFetch');
      const response = await authFetch(`${this.config.access.baseUrl}available/`);
      if (response.ok) {
        const data = await response.json();
        return Object.keys(data);
      }
    } catch (error) {
      console.warn('Failed to fetch available countries:', error);
    }
    return [];
  }

  async getAvailableAdminLevels(country: string): Promise<string[]> {
    try {
      const normalizedCountry = this.normalizeCountryCode(country);
      const { authFetch } = await import('../utils/authFetch');
      const response = await authFetch(`${this.config.access.baseUrl}available/`);
      if (response.ok) {
        const data = await response.json();
        return data[normalizedCountry] || [];
      }
    } catch (error) {
      console.warn(`Failed to fetch available admin levels for ${country}:`, error);
    }
    return [];
  }
}
