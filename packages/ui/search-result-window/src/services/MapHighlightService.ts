import type { NodeId } from '@hierarchidb/core-types';
import type { MapHighlightState, MapHighlightStyles } from '../types/index.js';

/**
    */
export class MapHighlightService {
  private searchMatchedNodes = new Set<NodeId>();
  private selectedNodes = new Set<NodeId>();
  private focusedNode: NodeId | null = null;
  private onStateChangeCallback?: (state: MapHighlightState) => void;

  private defaultStyles: MapHighlightStyles = {
    searchMatch: {
      fillColor: '#FFE082', fillOpacity: 0.6,
    },
    selection: {
      strokeColor: '#1976D2', strokeWidth: 3,
      strokeOpacity: 0.9,
    },
  };

  constructor(
    private customStyles?: Partial<MapHighlightStyles>,
    private mapInstance?: any, //  MapLibre GL JS
  ) {
    if (customStyles) {
      this.defaultStyles = { ...this.defaultStyles, ...customStyles };
    }
  }

  /**
            */
  setOnStateChange(callback: (state: MapHighlightState) => void): void {
    this.onStateChangeCallback = callback;
  }

  /**
            */
  setSearchMatched(nodeIds: NodeId[]): void {
    this.searchMatchedNodes.clear();
    nodeIds.forEach((id) => this.searchMatchedNodes.add(id));
    this.notifyStateChange();
    this.updateMapHighlight();
  }

  /**
            */
  setSelected(nodeIds: NodeId[]): void {
    this.selectedNodes.clear();
    nodeIds.forEach((id) => this.selectedNodes.add(id));
    this.notifyStateChange();
    this.updateMapHighlight();
  }

  /**
            */
  addSearchMatched(nodeId: NodeId): void {
    this.searchMatchedNodes.add(nodeId);
    this.notifyStateChange();
    this.updateMapHighlight();
  }

  /**
            */
  addSelected(nodeId: NodeId): void {
    this.selectedNodes.add(nodeId);
    this.notifyStateChange();
    this.updateMapHighlight();
  }

  /**
            */
  removeSearchMatched(nodeId: NodeId): void {
    this.searchMatchedNodes.delete(nodeId);
    this.notifyStateChange();
    this.updateMapHighlight();
  }

  /**
            */
  removeSelected(nodeId: NodeId): void {
    this.selectedNodes.delete(nodeId);
    this.notifyStateChange();
    this.updateMapHighlight();
  }

  /**
            */
  clearAll(): void {
    this.searchMatchedNodes.clear();
    this.selectedNodes.clear();
    this.notifyStateChange();
    this.updateMapHighlight();
  }

  /**
            */
  clearSearchMatched(): void {
    this.searchMatchedNodes.clear();
    this.notifyStateChange();
    this.updateMapHighlight();
  }

  /**
            */
  clearSelected(): void {
    this.selectedNodes.clear();
    this.notifyStateChange();
    this.updateMapHighlight();
  }

  /**
            */
  getState(): MapHighlightState {
    return {
      searchMatched: new Set(this.searchMatchedNodes),
      selected: new Set(this.selectedNodes),
      focused: this.focusedNode,
      styles: this.defaultStyles,
    };
  }

  /**
            */
  getStyles(): MapHighlightStyles {
    return this.defaultStyles;
  }

  /**
            */
  updateStyles(styles: Partial<MapHighlightStyles>): void {
    this.defaultStyles = { ...this.defaultStyles, ...styles };
    this.updateMapHighlight();
  }

  /**
      * MapLibre GL JS
      */
  setMapInstance(mapInstance: any): void {
    this.mapInstance = mapInstance;
    this.setupMapLayers();
    this.updateMapHighlight();
  }

  /**
            */
  private notifyStateChange(): void {
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(this.getState());
    }
  }

  /**
            */
  private setupMapLayers(): void {
    if (!this.mapInstance) return;

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
            */
  private updateMapHighlight(): void {
    if (!this.mapInstance) return;

    try {
      const searchMatchFilter = [
        'in',
        ['get', 'nodeId'],
        ['literal', Array.from(this.searchMatchedNodes)],
      ];

      if (this.mapInstance.getLayer('search-highlight-fill')) {
        this.mapInstance.setFilter('search-highlight-fill', searchMatchFilter);
      }

      const selectionFilter = [
        'in',
        ['get', 'nodeId'],
        ['literal', Array.from(this.selectedNodes)],
      ];

      if (this.mapInstance.getLayer('selection-highlight-line')) {
        this.mapInstance.setFilter('selection-highlight-line', selectionFilter);
      }
    } catch (error) {
      console.warn('Failed to update map highlight:', error);
    }
  }
}
