/**
 * 【機能概要】: BaseMapプラグインの拡張定義
 * 【実装方針】: folderプラグインを継承し、地理的ベースレイヤー設定機能を追加
 * 【アーキテクチャ】: Spreadsheetプラグインのパターンに従った実装
 * 🟢 信頼性レベル: Folder拡張パターンに準拠
 */

import type { FolderEntity } from '@hierarchidb/node-type-folder-plugin';

// Step コンポーネントのインポート
import { MapStyleStep } from './components/MapStyleStep';
import { MapViewportStep } from './components/MapViewportStep';
import { DisplayOptionsStep } from './components/DisplayOptionsStep';

/**
 * 【型定義】: BaseMapEntityの拡張フィールド型
 * 🟢 信頼性レベル: 地理情報システムの標準パターンに基づく
 */
interface BaseMapExtendedFields {
  baseMapMetadataId?: string;
  mapStyle: {
    style: 'streets' | 'satellite' | 'terrain' | 'dark' | 'light' | 'custom';
    customStyleUrl?: string;
    customStyleConfig?: Record<string, any>;
  };
  viewport: {
    center: [number, number]; // [longitude, latitude]
    zoom: number;
    bearing: number;
    pitch: number;
  };
  displayOptions: {
    show3dBuildings: boolean;
    showTraffic: boolean;
    showTransit: boolean;
    showTerrain: boolean;
    showLabels: boolean;
    attribution?: string;
    tags?: string[];
  };
}

/**
 * 【型定義】: BaseMapEntityの完全な型定義
 * 🟢 信頼性レベル: FolderEntityを継承
 */
export interface BaseMapEntity extends FolderEntity, BaseMapExtendedFields {
  // FolderEntityから継承: id, nodeId, name, description, createdAt, updatedAt, version
  // BaseMapExtendedFieldsから追加: baseMapMetadataId, mapStyle, viewport, displayOptions
}

/**
 * 【型定義】: BaseMapWorkingCopyの型定義
 * 🟢 信頼性レベル: Working Copyパターンに基づく
 */
export interface BaseMapWorkingCopy extends BaseMapEntity {
  isDraft: boolean;
  originalId?: string;
  copiedAt: number;
}

/**
 * 【拡張定義】: BaseMapプラグインの拡張定義オブジェクト
 * 【実装方針】: ExtendableNodeTypeDefinition型に準拠した定義
 * 🟢 信頼性レベル: Spreadsheetプラグインの実装パターンに完全準拠
 */
export const BaseMapExtension = {
  // 【拡張定義】: folderプラグインを拡張
  extends: 'folder',
  
  // 【メタデータ定義】: プラグインの基本情報
  nodeType: 'basemap',
  name: 'BaseMap',
  displayName: 'ベースマップ',
  icon: 'map', // Material Iconのマップアイコン
  color: '#4CAF50', // Material Designのgreen[500]
  
  // 【拡張ステップ定義】: Step 2, Step 3, Step 4を追加
  extendedSteps: [
    {
      stepNumber: 2,
      title: 'Map Style',
      component: MapStyleStep,
      validation: {
        validate: async (data: any) => {
          if (!data.mapStyle?.style) {
            return { isValid: false, errors: ['Map style selection is required'] };
          }
          if (data.mapStyle.style === 'custom' && !data.mapStyle.customStyleUrl) {
            return { isValid: false, errors: ['Custom style URL is required when custom style is selected'] };
          }
          return { isValid: true, errors: [] };
        }
      }
    },
    {
      stepNumber: 3,
      title: 'Map Viewport',
      component: MapViewportStep,
      validation: {
        validate: async (data: any) => {
          if (!data.viewport) {
            return { isValid: false, errors: ['Viewport configuration is required'] };
          }
          const { center, zoom } = data.viewport;
          if (!center || center.length !== 2 || typeof center[0] !== 'number' || typeof center[1] !== 'number') {
            return { isValid: false, errors: ['Valid center coordinates are required'] };
          }
          if (typeof zoom !== 'number' || zoom < 0 || zoom > 24) {
            return { isValid: false, errors: ['Zoom level must be between 0 and 24'] };
          }
          return { isValid: true, errors: [] };
        }
      }
    },
    {
      stepNumber: 4,
      title: 'Display Options',
      component: DisplayOptionsStep,
      validation: {
        validate: async () => {
          // Display options are optional, so always return true
          return { isValid: true, errors: [] };
        }
      }
    }
  ],

  // 【拡張フィールド定義】: BaseMap固有フィールド
  extendedFields: [
    {
      name: 'baseMapMetadataId',
      type: 'string',
      required: false,
      label: 'BaseMap Metadata ID',
      description: 'Internal metadata identifier'
    },
    {
      name: 'mapStyle',
      type: 'object',
      required: true,
      label: 'Map Style',
      description: 'Map styling configuration including style type and custom options'
    },
    {
      name: 'viewport',
      type: 'object',
      required: true,
      label: 'Viewport',
      description: 'Map viewport configuration including center, zoom, bearing, and pitch'
    },
    {
      name: 'displayOptions',
      type: 'object',
      required: false,
      label: 'Display Options',
      description: 'Map display options including layers, labels, and attribution'
    }
  ],

  // 【拡張バリデーション】: BaseMap固有のバリデーション
  extendedValidation: {
    extendedRules: {
      coordinateRangeRule: {
        validate: (data: any) => {
          if (!data.viewport?.center) return true;
          const [lng, lat] = data.viewport.center;
          return lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
        },
        message: '座標は有効な範囲内である必要があります（経度: -180～180, 緯度: -90～90）'
      },
      customStyleUrlRule: {
        validate: (data: any) => {
          if (data.mapStyle?.style !== 'custom') return true;
          if (!data.mapStyle?.customStyleUrl) return false;
          try {
            new URL(data.mapStyle.customStyleUrl);
            return true;
          } catch {
            return false;
          }
        },
        message: 'カスタムスタイルURLは有効なURL形式である必要があります'
      }
    },
    chainMode: 'all',
    mergeStrategy: 'append'
  }
};