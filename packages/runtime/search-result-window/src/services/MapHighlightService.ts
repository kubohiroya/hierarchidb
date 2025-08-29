import type { NodeId } from '@hierarchidb/core';
import type { MapHighlightState, MapHighlightStyles } from '~/types';

/**
 * 地図上の要素の強調表示を管理するサービス
 */
export class MapHighlightService {
  private searchMatchedNodes = new Set<NodeId>();
  private selectedNodes = new Set<NodeId>();
  private onStateChangeCallback?: (state: MapHighlightState) => void;

  private defaultStyles: MapHighlightStyles = {
    searchMatch: {
      fillColor: '#FFE082',    // 黄色系の塗りつぶし
      fillOpacity: 0.6,
    },
    selection: {
      strokeColor: '#1976D2',  // 青色の線
      strokeWidth: 3,
      strokeOpacity: 0.9,
    },
  };

  constructor(
    private customStyles?: Partial<MapHighlightStyles>,
    private mapInstance?: any // MapLibre GL JSのマップインスタンス
  ) {
    if (customStyles) {
      this.defaultStyles = { ...this.defaultStyles, ...customStyles };
    }
  }

  /**
   * 状態変更コールバックを設定
   */
  setOnStateChange(callback: (state: MapHighlightState) => void): void {
    this.onStateChangeCallback = callback;
  }

  /**
   * 検索マッチした要素を設定
   */
  setSearchMatched(nodeIds: NodeId[]): void {
    this.searchMatchedNodes.clear();
    nodeIds.forEach(id => this.searchMatchedNodes.add(id));
    this.notifyStateChange();
    this.updateMapHighlight();
  }

  /**
   * 選択された要素を設定
   */
  setSelected(nodeIds: NodeId[]): void {
    this.selectedNodes.clear();
    nodeIds.forEach(id => this.selectedNodes.add(id));
    this.notifyStateChange();
    this.updateMapHighlight();
  }

  /**
   * 要素を検索マッチに追加
   */
  addSearchMatched(nodeId: NodeId): void {
    this.searchMatchedNodes.add(nodeId);
    this.notifyStateChange();
    this.updateMapHighlight();
  }

  /**
   * 要素を選択に追加
   */
  addSelected(nodeId: NodeId): void {
    this.selectedNodes.add(nodeId);
    this.notifyStateChange();
    this.updateMapHighlight();
  }

  /**
   * 要素を検索マッチから削除
   */
  removeSearchMatched(nodeId: NodeId): void {
    this.searchMatchedNodes.delete(nodeId);
    this.notifyStateChange();
    this.updateMapHighlight();
  }

  /**
   * 要素を選択から削除
   */
  removeSelected(nodeId: NodeId): void {
    this.selectedNodes.delete(nodeId);
    this.notifyStateChange();
    this.updateMapHighlight();
  }

  /**
   * 全ての強調表示をクリア
   */
  clearAll(): void {
    this.searchMatchedNodes.clear();
    this.selectedNodes.clear();
    this.notifyStateChange();
    this.updateMapHighlight();
  }

  /**
   * 検索マッチのみクリア
   */
  clearSearchMatched(): void {
    this.searchMatchedNodes.clear();
    this.notifyStateChange();
    this.updateMapHighlight();
  }

  /**
   * 選択のみクリア
   */
  clearSelected(): void {
    this.selectedNodes.clear();
    this.notifyStateChange();
    this.updateMapHighlight();
  }

  /**
   * 現在の状態を取得
   */
  getState(): MapHighlightState {
    return {
      searchMatched: new Set(this.searchMatchedNodes),
      selected: new Set(this.selectedNodes),
    };
  }

  /**
   * スタイル設定を取得
   */
  getStyles(): MapHighlightStyles {
    return this.defaultStyles;
  }

  /**
   * スタイル設定を更新
   */
  updateStyles(styles: Partial<MapHighlightStyles>): void {
    this.defaultStyles = { ...this.defaultStyles, ...styles };
    this.updateMapHighlight();
  }

  /**
   * MapLibre GL JSインスタンスを設定
   */
  setMapInstance(mapInstance: any): void {
    this.mapInstance = mapInstance;
    this.setupMapLayers();
    this.updateMapHighlight();
  }

  /**
   * 状態変更を通知
   */
  private notifyStateChange(): void {
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(this.getState());
    }
  }

  /**
   * 地図上にハイライト用のレイヤーを設定
   */
  private setupMapLayers(): void {
    if (!this.mapInstance) return;

    // 検索マッチ用レイヤー（塗りつぶし）
    if (!this.mapInstance.getLayer('search-highlight-fill')) {
      this.mapInstance.addLayer({
        id: 'search-highlight-fill',
        type: 'fill',
        source: 'search-highlight-source',
        paint: {
          'fill-color': this.defaultStyles.searchMatch.fillColor,
          'fill-opacity': this.defaultStyles.searchMatch.fillOpacity,
        },
        filter: ['in', ['get', 'nodeId'], ['literal', []]],
      });
    }

    // 選択用レイヤー（線）
    if (!this.mapInstance.getLayer('selection-highlight-line')) {
      this.mapInstance.addLayer({
        id: 'selection-highlight-line',
        type: 'line',
        source: 'selection-highlight-source',
        paint: {
          'line-color': this.defaultStyles.selection.strokeColor,
          'line-width': this.defaultStyles.selection.strokeWidth,
          'line-opacity': this.defaultStyles.selection.strokeOpacity,
        },
        filter: ['in', ['get', 'nodeId'], ['literal', []]],
      });
    }
  }

  /**
   * 地図上のハイライトを更新
   */
  private updateMapHighlight(): void {
    if (!this.mapInstance) return;

    try {
      // 検索マッチハイライトの更新
      const searchMatchFilter = [
        'in',
        ['get', 'nodeId'],
        ['literal', Array.from(this.searchMatchedNodes)]
      ];

      if (this.mapInstance.getLayer('search-highlight-fill')) {
        this.mapInstance.setFilter('search-highlight-fill', searchMatchFilter);
      }

      // 選択ハイライトの更新
      const selectionFilter = [
        'in',
        ['get', 'nodeId'],
        ['literal', Array.from(this.selectedNodes)]
      ];

      if (this.mapInstance.getLayer('selection-highlight-line')) {
        this.mapInstance.setFilter('selection-highlight-line', selectionFilter);
      }

    } catch (error) {
      console.warn('Failed to update map highlight:', error);
    }
  }
}