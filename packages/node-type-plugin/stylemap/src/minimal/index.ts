/**
 * Minimal StyleMap Plugin
 * Just CSV to color mapping - nothing more
 */

import { NodeId } from '@hierarchidb/common-core';

// Simple types - no complexity
export interface StyleMapData {
  nodeId: NodeId;
  csvContent?: string;
  keyColumn?: string;
  valueColumn?: string;
  colors?: string[];
}

// Simple handler - just store and retrieve
export class StyleMapHandler {
  private data = new Map<NodeId, StyleMapData>();

  save(nodeId: NodeId, data: StyleMapData): void {
    this.data.set(nodeId, { ...data, nodeId });
  }

  get(nodeId: NodeId): StyleMapData | undefined {
    return this.data.get(nodeId);
  }

  delete(nodeId: NodeId): void {
    this.data.delete(nodeId);
  }

  // Generate simple color mapping
  generateColors(data: StyleMapData): Record<string, string> {
    if (!data.csvContent) return {};
    
    const lines = data.csvContent.split('\n');
    const colors = data.colors || ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF'];
    const result: Record<string, string> = {};
    
    lines.forEach((line, index) => {
      const key = line.split(',')[0];
      if (key) {
        result[key] = colors[index % colors.length] || '#808080';
      }
    });
    
    return result;
  }
}

// Simple API
export const styleMapAPI = {
  handler: new StyleMapHandler(),
  
  create(nodeId: NodeId, data: StyleMapData): void {
    this.handler.save(nodeId, data);
  },
  
  read(nodeId: NodeId): StyleMapData | undefined {
    return this.handler.get(nodeId);
  },
  
  update(nodeId: NodeId, data: Partial<StyleMapData>): void {
    const existing = this.handler.get(nodeId);
    if (existing) {
      this.handler.save(nodeId, { ...existing, ...data });
    }
  },
  
  delete(nodeId: NodeId): void {
    this.handler.delete(nodeId);
  },
  
  generateStyles(nodeId: NodeId): Record<string, string> {
    const data = this.handler.get(nodeId);
    return data ? this.handler.generateColors(data) : {};
  }
};

// Export for plugin registration
export const StyleMapPlugin = {
  nodeType: 'stylemap',
  name: 'StyleMap',
  version: '1.0.0',
  api: styleMapAPI
};