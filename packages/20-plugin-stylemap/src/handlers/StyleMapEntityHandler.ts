import type { NodeId } from '@hierarchidb/00-core';
import type { StyleMapEntity, StyleMapColorRule, StyleMapStyle, SpreadsheetMetadataId } from '~/entities/StyleMapEntity';

// Note: BaseReferenceCountingHandler is now available in @hierarchidb/worker/src/handlers/BaseReferenceCountingHandler
// This local implementation should be migrated when plugin architecture allows direct worker dependencies
// Local BaseReferenceCountingHandler interface (since worker package not available in plugin)
interface ReferenceCountingHandler {
  incrementReferenceCount(nodeId: NodeId): Promise<void>;
  decrementReferenceCount(nodeId: NodeId): Promise<void>;
  getReferenceCount?(nodeId: NodeId): Promise<number>;
}

abstract class BaseReferenceCountingHandler implements ReferenceCountingHandler {
  protected abstract getNodeRefField(): string;
  protected abstract getRelRefField(): string;
  
  protected abstract getPeerEntity(nodeId: NodeId): Promise<any>;
  protected abstract deletePeerEntity(nodeId: NodeId): Promise<void>;
  protected abstract deleteRelationalEntity(relRef: any): Promise<void>;
  protected abstract countPeerEntitiesByRelRef(relRef: any): Promise<number>;

  async incrementReferenceCount(_nodeId: NodeId): Promise<void> {
    // PeerEntityが作成されることで、自然に参照カウントが増加
  }

  async decrementReferenceCount(nodeId: NodeId): Promise<void> {
    const peerEntity = await this.getPeerEntity(nodeId);
    if (!peerEntity) return;

    const relRefField = this.getRelRefField();
    const relRef = peerEntity[relRefField];

    await this.deletePeerEntity(nodeId);
    const remainingCount = await this.countPeerEntitiesByRelRef(relRef);

    if (remainingCount === 0) {
      await this.deleteRelationalEntity(relRef);
    }
  }

  async getReferenceCount(nodeId: NodeId): Promise<number> {
    const peerEntity = await this.getPeerEntity(nodeId);
    if (!peerEntity) return 0;

    const relRefField = this.getRelRefField();
    const relRef = peerEntity[relRefField];
    
    return await this.countPeerEntitiesByRelRef(relRef);
  }
}

// Define minimal interfaces
interface SpreadsheetEntityHandler {
  importFromFile(nodeId: NodeId, file: File): Promise<{ id: SpreadsheetMetadataId }>;
  getSpreadsheetData(nodeId: NodeId): Promise<any>;
  getRows(nodeId: NodeId): Promise<Record<string, unknown>[]>;
}

/**
 * StyleMapEntityHandler - Simplified handler that extends spreadsheet functionality
 * Implements ReferenceCountingHandler for centralized reference management
 */
export class StyleMapEntityHandler extends BaseReferenceCountingHandler {
  constructor(private spreadsheetHandler: SpreadsheetEntityHandler) {
    super();
  }

  // BaseReferenceCountingHandler implementation
  protected getNodeRefField(): string {
    return 'nodeId'; // Default field name from EntityReferenceHints
  }

  protected getRelRefField(): string {
    return 'spreadsheetMetadataId'; // Custom field name from EntityReferenceHints
  }

  // Remove refCountField - using natural reference counting

  protected async getPeerEntity(nodeId: NodeId): Promise<StyleMapEntity | null> {
    return await this.getStyleMapEntity(nodeId);
  }

  protected async deletePeerEntity(nodeId: NodeId): Promise<void> {
    await this.deleteStyleMapEntity(nodeId);
  }

  protected async deleteRelationalEntity(_relRef: SpreadsheetMetadataId): Promise<void> {
    // StyleMap doesn't own the SpreadsheetMetadata, so we don't delete it
    // The actual RelationalEntity deletion is handled by SpreadsheetEntityHandler
  }

  protected async countPeerEntitiesByRelRef(relRef: SpreadsheetMetadataId): Promise<number> {
    // Count how many StyleMapEntity reference this spreadsheetMetadataId
    return await this.countStyleMapsBySpreadsheet(relRef);
  }

  /**
   * Create StyleMap from existing spreadsheet data
   */
  async createFromSpreadsheet(
    nodeId: NodeId,
    spreadsheetMetadataId: SpreadsheetMetadataId,
    config: {
      keyColumn: string;
      colorRules: StyleMapColorRule[];
      defaultStyle: StyleMapStyle;
      description?: string;
    }
  ): Promise<StyleMapEntity> {
    const entity: StyleMapEntity = {
      nodeId,
      spreadsheetMetadataId,
      keyColumn: config.keyColumn,
      colorRules: config.colorRules,
      defaultStyle: config.defaultStyle,
      description: config.description,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };

    // Store in database (implemented by Worker)
    await this.storeStyleMapEntity(entity);
    
    return entity;
  }

  /**
   * Create StyleMap with new spreadsheet import
   */
  async createWithSpreadsheetImport(
    nodeId: NodeId,
    file: File,
    config: {
      keyColumn: string;
      colorRules: StyleMapColorRule[];
      defaultStyle: StyleMapStyle;
      description?: string;
    }
  ): Promise<{ styleMap: StyleMapEntity; spreadsheetMetadata: any }> {
    // Import spreadsheet first
    const spreadsheetMetadata = await this.spreadsheetHandler.importFromFile(nodeId, file);
    
    // Create StyleMap referencing the spreadsheet
    const styleMap = await this.createFromSpreadsheet(
      nodeId,
      spreadsheetMetadata.id,
      config
    );

    return { styleMap, spreadsheetMetadata };
  }

  /**
   * Get StyleMap with associated spreadsheet data
   */
  async getStyleMapWithData(nodeId: NodeId): Promise<{
    styleMap: StyleMapEntity;
    spreadsheetData: any;
  } | null> {
    const styleMap = await this.getStyleMapEntity(nodeId);
    if (!styleMap) return null;

    const spreadsheetData = await this.spreadsheetHandler.getSpreadsheetData(nodeId);
    if (!spreadsheetData) return null;

    return { styleMap, spreadsheetData };
  }

  /**
   * Apply style rules to get styled data
   */
  async getStyledData(nodeId: NodeId): Promise<Array<{
    row: Record<string, unknown>;
    style: StyleMapStyle;
  }>> {
    const data = await this.getStyleMapWithData(nodeId);
    if (!data) return [];

    const { styleMap } = data;
    const rows = await this.spreadsheetHandler.getRows(nodeId);

    return rows.map(row => {
      // Find matching color rule
      const matchingRule = styleMap.colorRules.find(rule => 
        this.evaluateRule(row[rule.column], rule)
      );

      const style = matchingRule ? matchingRule.style : styleMap.defaultStyle;

      return { row, style };
    });
  }

  /**
   * Update StyleMap configuration
   */
  async updateStyleMap(
    nodeId: NodeId,
    updates: Partial<{
      keyColumn: string;
      colorRules: StyleMapColorRule[];
      defaultStyle: StyleMapStyle;
      description: string;
    }>
  ): Promise<StyleMapEntity> {
    const existing = await this.getStyleMapEntity(nodeId);
    if (!existing) {
      throw new Error('StyleMap not found');
    }

    const updated: StyleMapEntity = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
      version: existing.version + 1,
    };

    await this.storeStyleMapEntity(updated);
    return updated;
  }

  /**
   * Delete StyleMap (keeps underlying spreadsheet data)
   * LifecycleManagerが自動的に参照カウント管理を行う
   */
  async deleteEntity(nodeId: NodeId): Promise<void> {
    // PeerEntity削除のみ行う
    // 参照カウント管理はLifecycleManagerが自動実行
    await this.deleteStyleMapEntity(nodeId);
  }

  /**
   * Evaluate a style rule against a value
   */
  private evaluateRule(value: unknown, rule: StyleMapColorRule): boolean {
    switch (rule.operator) {
      case 'equals':
        return value === rule.value;
      case 'contains':
        return String(value).includes(String(rule.value));
      case 'greaterThan':
        return Number(value) > Number(rule.value);
      case 'lessThan':
        return Number(value) < Number(rule.value);
      case 'range':
        const numValue = Number(value);
        const minValue = Number(rule.value);
        const maxValue = Number(rule.maxValue);
        return numValue >= minValue && numValue <= maxValue;
      default:
        return false;
    }
  }

  // These methods would be implemented by the Worker layer
  private async storeStyleMapEntity(_entity: StyleMapEntity): Promise<void> {
    throw new Error('Not implemented - should be handled by Worker');
  }

  private async getStyleMapEntity(_nodeId: NodeId): Promise<StyleMapEntity | null> {
    throw new Error('Not implemented - should be handled by Worker');
  }

  private async deleteStyleMapEntity(_nodeId: NodeId): Promise<void> {
    throw new Error('Not implemented - should be handled by Worker');
  }

  private async countStyleMapsBySpreadsheet(_spreadsheetMetadataId: SpreadsheetMetadataId): Promise<number> {
    throw new Error('Not implemented - should be handled by Worker');
  }
}