import type { TreeNodeId } from '@hierarchidb/core';
import type { PluginLoader } from './PluginLoader';

/**
 * プラグイン固有APIへのアクセスを提供するサービス
 *
 * このサービスは、プラグインが提供する特殊なAPIメソッドへの
 * 統一的なアクセスインターフェースを提供します。
 */
export class PluginAPIService {
  constructor(private pluginLoader: PluginLoader) {}

  /**
   * プラグインAPIを呼び出す
   * @param pluginId プラグインID
   * @param methodName メソッド名
   * @param args 引数
   * @returns メソッドの戻り値
   */
  async callPluginAPI(pluginId: string, methodName: string, ...args: any[]): Promise<any> {
    const api = this.pluginLoader.getPluginAPI(pluginId);

    if (!api) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    const method = api[methodName];

    if (!method) {
      throw new Error(`Method not found: ${methodName} in plugin ${pluginId}`);
    }

    return await method(...args);
  }

  /**
   * プラグインAPIメソッドの存在確認
   * @param pluginId プラグインID
   * @param methodName メソッド名
   * @returns メソッドが存在するか
   */
  hasPluginAPI(pluginId: string, methodName: string): boolean {
    const api = this.pluginLoader.getPluginAPI(pluginId);
    return api ? methodName in api : false;
  }

  /**
   * プラグインの利用可能なAPIメソッド一覧を取得
   * @param pluginId プラグインID
   * @returns メソッド名の配列
   */
  getAvailableAPIs(pluginId: string): string[] {
    const api = this.pluginLoader.getPluginAPI(pluginId);
    return api ? Object.keys(api) : [];
  }

  /**
   * すべてのプラグインのAPI一覧を取得
   * @returns プラグインIDとそのAPIメソッドのマップ
   */
  getAllPluginAPIs(): Map<string, string[]> {
    const result = new Map<string, string[]>();

    for (const plugin of this.pluginLoader.getAllPlugins()) {
      const apis = this.getAvailableAPIs(plugin.id);
      if (apis.length > 0) {
        result.set(plugin.id, apis);
      }
    }

    return result;
  }

  // ==================
  // 具体的なAPI呼び出しの例
  // ==================

  /**
   * BaseMapプラグインの地図スタイル変更
   */
  async changeMapStyle(
    nodeId: TreeNodeId,
    style: 'streets' | 'satellite' | 'hybrid' | 'terrain'
  ): Promise<void> {
    return await this.callPluginAPI('com.example.basemap', 'basemap.changeMapStyle', nodeId, style);
  }

  /**
   * BaseMapプラグインの境界設定
   */
  async setMapBounds(
    nodeId: TreeNodeId,
    bounds: [[number, number], [number, number]]
  ): Promise<void> {
    return await this.callPluginAPI('com.example.basemap', 'basemap.setBounds', nodeId, bounds);
  }

  /**
   * BaseMapプラグインのタイルキャッシュ
   */
  async cacheMapTile(
    nodeId: TreeNodeId,
    tile: { zoom: number; x: number; y: number; data: ArrayBuffer }
  ): Promise<void> {
    return await this.callPluginAPI('com.example.basemap', 'basemap.cacheTile', nodeId, tile);
  }

  /**
   * BaseMapプラグインのタイル取得
   */
  async getMapTile(nodeId: TreeNodeId, zoom: number, x: number, y: number): Promise<any> {
    return await this.callPluginAPI('com.example.basemap', 'basemap.getTile', nodeId, zoom, x, y);
  }

  /**
   * BaseMapプラグインの近隣地図検索
   */
  async findNearbyMaps(center: [number, number], radius: number): Promise<any[]> {
    return await this.callPluginAPI(
      'com.example.basemap',
      'basemap.findNearbyMaps',
      center,
      radius
    );
  }

  /**
   * BaseMapプラグインの状態エクスポート
   */
  async exportMapState(nodeId: TreeNodeId): Promise<any> {
    return await this.callPluginAPI('com.example.basemap', 'basemap.exportMapState', nodeId);
  }
}

/**
 * Worker APIからプラグインAPIを公開するための拡張
 */
export interface WorkerAPIPluginExtension {
  /**
   * プラグインAPIを呼び出す
   */
  callPluginAPI(pluginId: string, methodName: string, ...args: any[]): Promise<any>;

  /**
   * プラグインの利用可能なAPI一覧を取得
   */
  getPluginAPIs(pluginId: string): string[];

  /**
   * すべてのプラグインのAPI一覧を取得
   */
  getAllPluginAPIs(): Map<string, string[]>;
}
