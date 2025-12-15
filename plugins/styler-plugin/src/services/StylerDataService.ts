/**
 * @file StylerDataService.ts
 * @description Styler plugin data service integrating with Spreadsheet CSV API
 * : Styler
 * : SpreadsheetTabularApiDriverCSV
 * : Spreadsheet
 */

import type {
  TabularColumnInfo,
  TabularTableMetadata,
  TabularTableMetadataLike,
} from '@hierarchidb/tabular-store';
import type { MapLibreStyle } from '@hierarchidb/ui-map';
import type {
  TabularDataResult,
  TabularFilterRule,
  TabularProcessingConfig,
  TabularDataApi,
} from '@hierarchidb/ui-tabular-extract';
import type { StylerEntity, StylerMapping } from '../common/types/StylerEntity.js';
import type {
  ColorCalculationResult,
  StylerConfig,
  StylerTableRow,
} from '../common/types/StylerEntity.js';
import { valueToColor } from '../common/utils/colorUtils.js';

type StyledCellStyle = {
  backgroundColor: string;
  opacity?: number;
  metadata?: ColorCalculationResult['metadata'];
};

type StyledRow = {
  row: StylerTableRow;
  styles: Record<string, StyledCellStyle>;
};

export class StylerDataService {
  private tabularApiDriver: TabularDataApi;
  private pluginId: string = 'styler';

  constructor(tabularApiDriver: TabularDataApi) {
    this.tabularApiDriver = tabularApiDriver;
  }

  async importTabularDataFromFile(
    file: File,
    defaultConfig: TabularProcessingConfig = {}
  ): Promise<{
    tableMetadata: TabularTableMetadata;
    config: StylerConfig;
    mapping: StylerMapping;
  }> {
    const tableMetadata = await this.tabularApiDriver.uploadTabularFile(file, defaultConfig);

    //  Styler
    const {config, mapping} = this.generateInitialStylerConfig(tableMetadata);

    return {
      tableMetadata,
      config,
      mapping,
    };
  }

  async importTabularDataFromUrl(
    url: string,
    defaultConfig: TabularProcessingConfig = {}
  ): Promise<{
    tableMetadata: TabularTableMetadata;
    config: StylerConfig;
    mapping: StylerMapping;
  }> {
    const tableMetadata = await this.tabularApiDriver.downloadTabularFromUrl(url, defaultConfig);
    const {config, mapping} = this.generateInitialStylerConfig(tableMetadata);

    return {
      tableMetadata,
      config,
      mapping
    };
  }

  async getStyledPreview(
    tableId: string,
    mapping: StylerMapping,
    config: StylerConfig,
    filters: TabularFilterRule[] = [],
    rowCount: number = 100,
    valueColumn?: string,
  ): Promise<{ data: TabularDataResult; styledRows: StyledRow[] }> {
    //  Spreadsheet
    const data = await this.tabularApiDriver.getFilteredPreview(tableId, filters, rowCount);
    const effectiveValueColumn =
      valueColumn ??
      (mapping as { valueColumn?: string } | undefined)?.valueColumn ??
      (config as { valueColumn?: string } | undefined)?.valueColumn;

    const styledRows: StyledRow[] = data.rows.map((row) => {
      const styles: Record<string, StyledCellStyle> = {};

      if (effectiveValueColumn) {
        const value = row[effectiveValueColumn];
        if (typeof value === 'number') {
          const colorResult = valueToColor(value, mapping, config);
          styles[effectiveValueColumn] = {
            backgroundColor: colorResult.color,
            opacity: colorResult.opacity,
            metadata: colorResult.metadata,
          };
        }
      }

      return { row: row as StylerTableRow, styles };
    });

    return { data, styledRows };
  }

  async generateMapLibreStyle(
    tableId: string,
    entity: StylerEntity
  ): Promise<{ styleSpec: MapLibreStyle; colorMapping: Record<string, string> }> {
    const { config, mapping } = entity;
    const keyColumn = entity.keyColumn;
    const valueColumn = entity.valueColumn;

    if (!keyColumn || !valueColumn || !mapping.targetProperty) {
      throw new Error('Key column, value column, and target property are required');
    }

    const data = await this.tabularApiDriver.getFilteredPreview(tableId, [], 1000);
    const values = data.rows
      .map((row) => row[valueColumn])
      .filter((val): val is number => typeof val === 'number');

    if (values.length === 0) {
      throw new Error('No numeric values found in selected column');
    }

    const colorMapping: Record<string, string> = {};
    const styleSpec: MapLibreStyle = {
      version: 8,
      sources: {},
      layers: [
        {
          id: `styler-layer-${(entity as { treeNodeId?: string; id?: string }).treeNodeId ?? (entity as { id?: string }).id ?? 'styler'}`,
          type: 'fill',
          paint: {},
        },
      ],
    } as MapLibreStyle;
    const targetLayer = styleSpec.layers[0];
    if (!targetLayer) {
      throw new Error('Failed to initialize MapLibre layer for styler configuration');
    }


    values.forEach((value) => {
      const colorResult = valueToColor(value, mapping, config, values);
      colorMapping[value.toString()] = colorResult.color;
    });

    //  MapLibre paint
    if (mapping.targetProperty) {
      const colorStops = Object.entries(colorMapping).map(([value, color]) => [
        parseFloat(value),
        color,
      ]);

      const paint = (targetLayer.paint ??= {});
      paint[mapping.targetProperty] = [
        'interpolate',
        ['linear'],
        ['get', valueColumn],
        ...colorStops.flat(),
      ];
    }

    return { styleSpec, colorMapping };
  }

  async addTableReference(tableId: string): Promise<void> {
    await this.tabularApiDriver.addTableReference(tableId, this.pluginId);
  }

  async removeTableReference(tableId: string): Promise<void> {
    await this.tabularApiDriver.removeTableReference(tableId, this.pluginId);
  }

  async listStylerTables(): Promise<TabularTableMetadata[]> {
    const allTables = await this.tabularApiDriver.listTables();
    const filtered = allTables.tables.filter((table) =>
      table.referencingPlugins?.includes(this.pluginId)
    );
    return filtered.map((table) => this.ensureFullMetadata(table));
  }

  private generateInitialStylerConfig(tableMetadata: TabularTableMetadata): {config: StylerConfig, mapping: StylerMapping} {
    const numericColumns = tableMetadata.columns.filter(
      (col: TabularColumnInfo) => col.type === 'number'
    );
    const initialValueColumn = numericColumns[0]?.name;
    if (initialValueColumn === undefined) {
      throw new Error('No numeric columns found in the table');
    }
    const mapping = {
      styleType: 'choropleth' as const,
      valueColumn: initialValueColumn,
      keyColumn:
        tableMetadata.columns.find((col: TabularColumnInfo) => col.name === 'id')?.name ??
        tableMetadata.columns[0]?.name ?? "",
      targetProperty: 'fill-color' as const,
    } satisfies StylerMapping;

    const config: StylerConfig = {
      algorithm: 'linear',
      colorSpace: 'hsv',
      // targetProperty: 'fill-color',
      //enabled: true,
      min: 0,
      max: 100,
      hueStart: 0,
      hueEnd: 120,
      saturation: 0.8,
      brightness: 0.9,
    };

    return {mapping, config};
  }

  private ensureFullMetadata(table: TabularTableMetadataLike): TabularTableMetadata {
    return {
      id: table.id,
      filename: table.filename ?? `${table.id}.csv`,
      fileUrl: table.fileUrl,
      contentHash: table.contentHash ?? '',
      fileSizeBytes: table.fileSizeBytes ?? 0,
      totalRows: table.totalRows ?? 0,
      columns: table.columns ?? [],
      createdAt: table.createdAt ?? Date.now(),
      updatedAt: table.updatedAt,
      referenceCount: table.referenceCount ?? table.referencingPlugins?.length ?? 0,
      referencingPlugins: table.referencingPlugins ?? [],
      isChunked: table.isChunked ?? false,
      chunkCount: table.chunkCount ?? 0,
    };
  }
}
