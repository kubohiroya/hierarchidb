/**
  * @file StylerDataService.ts
 * @description Styler plugin data service integrating with Spreadsheet CSV API
 * : Styler
 * : SpreadsheetCSVApiDriverCSV
 * : Spreadsheet
  */

import type {
  CSVDataResult,
  CSVFilterRule,
  CSVProcessingConfig,
  TabularDataApi,
} from '@hierarchidb/ui-tabular-extract';
import type {
  CSVColumnInfo,
  CSVTableMetadata,
  CSVTableMetadataLike,
} from '@hierarchidb/tabular-store';

import type { StylerEntity } from '../common/types/StylerEntity.js';
import type { StylerConfig } from '../common/types/stylerTypes.js';
import { valueToColor } from '../common/utils/colorUtils.js';

/**
  * : Styler
 * : SpreadsheetCSV
 * :
 * : Spreadsheet
  */
export class StylerDataService {
  private csvApiDriver: TabularDataApi;
  private pluginId: string = 'styler';

  constructor(csvApiDriver: TabularDataApi) {
    this.csvApiDriver = csvApiDriver;
  }

  /**
      * : CSV
   * : SpreadsheetuploadCSVFile
   * : Styler
   * : Spreadsheet
      */
  async uploadCSVFile(
    file: File,
    config: CSVProcessingConfig = {},
  ): Promise<{
    tableMetadata: CSVTableMetadata;
    suggestedConfig: Partial<StylerConfig>;
  }> {
    //  SpreadsheetCSV
    const tableMetadata = await this.csvApiDriver.uploadCSVFile(file, config);

    //  Styler
    const suggestedConfig = this.generateInitialStylerConfig(tableMetadata);

    return {
      tableMetadata,
      suggestedConfig,
    };
  }

  /**
      * : URLCSV
   * : SpreadsheetdownloadCSVFromUrl
   * : Spreadsheet
      */
  async downloadCSVFromUrl(
    url: string,
    config: CSVProcessingConfig = {},
  ): Promise<{
    tableMetadata: CSVTableMetadata;
    suggestedConfig: Partial<StylerConfig>;
  }> {
    const tableMetadata = await this.csvApiDriver.downloadCSVFromUrl(url, config);
    const suggestedConfig = this.generateInitialStylerConfig(tableMetadata);

    return {
      tableMetadata,
      suggestedConfig,
    };
  }

  /**
      * :
   * : SpreadsheetStyler
   * :
   * :
      */
  async getStyledPreview(
    tableId: string,
    stylerConfig: StylerConfig,
    filters: CSVFilterRule[] = [],
    rowCount: number = 100,
  ): Promise<{
    data: CSVDataResult;
    styledRows: Array<{
      row: Record<string, any>;
      styles: Record<string, any>;
    }>;
  }> {
    //  Spreadsheet
    const data = await this.csvApiDriver.getFilteredPreview(tableId, filters, rowCount);

    const styledRows = data.rows.map((row) => {
      const styles: Record<string, any> = {};

      if (stylerConfig.valueColumn) {
        const value = row[stylerConfig.valueColumn];
        if (typeof value === 'number') {
          const colorResult = valueToColor(value, stylerConfig);
          styles[stylerConfig.valueColumn] = {
            backgroundColor: colorResult.color,
            opacity: colorResult.opacity,
            metadata: colorResult.metadata,
          };
        }
      }

      return { row, styles };
    });

    return { data, styledRows };
  }

  /**
      * : MapLibre
   * : StylerConfigMapLibre GL JS
   * : MapLibre
   * : MapLibre
      */
  async generateMapLibreStyle(
    tableId: string,
    entity: StylerEntity,
  ): Promise<{
    styleSpec: any;
    colorMapping: Record<string, string>;
  }> {
    const { stylerConfig, selectedKeyColumn, selectedValueColumn } = entity;

    if (!selectedKeyColumn || !selectedValueColumn || !stylerConfig.targetProperty) {
      throw new Error('Key column, value column, and target property are required');
    }

    const data = await this.csvApiDriver.getFilteredPreview(tableId, [], 1000);
    const values = data.rows
      .map((row) => row[selectedValueColumn])
      .filter((val) => typeof val === 'number') as number[];

    if (values.length === 0) {
      throw new Error('No numeric values found in selected column');
    }

    const colorMapping: Record<string, string> = {};
    const styleSpec: any = {
      version: 8,
      sources: {},
      layers: [
        {
          id: `styler-layer-${entity.id}`,
          type: 'fill', paint: {},
        },
      ],
    };

    values.forEach((value) => {
      const colorResult = valueToColor(value, stylerConfig, values);
      colorMapping[value.toString()] = colorResult.color;
    });

    //  MapLibre paint
    if (stylerConfig.targetProperty) {
      const colorStops = Object.entries(colorMapping).map(([value, color]) => [
        parseFloat(value),
        color,
      ]);

      styleSpec.layers[0].paint[stylerConfig.targetProperty] = [
        'interpolate',
        ['linear'],
        ['get', selectedValueColumn],
        ...colorStops.flat(),
      ];
    }

    return { styleSpec, colorMapping };
  }

  /**
      * :
   * : SpreadsheetaddTableReference
   * :
      */
  async addTableReference(tableId: string): Promise<void> {
    await this.csvApiDriver.addTableReference(tableId, this.pluginId);
  }

  /**
      * :
   * : SpreadsheetremoveTableReference
   * :
      */
  async removeTableReference(tableId: string): Promise<void> {
    await this.csvApiDriver.removeTableReference(tableId, this.pluginId);
  }

  /**
      * :
   * : Styler
   * :
      */
  async listStylerTables(): Promise<CSVTableMetadata[]> {
    const allTables = await this.csvApiDriver.listTables();
    const filtered = allTables.tables.filter((table) => table.referencingPlugins?.includes(this.pluginId));
    return filtered.map((table) => this.ensureFullMetadata(table));
  }

  /**
      * : Styler
   * :
   * :
      */
  private generateInitialStylerConfig(tableMetadata: CSVTableMetadata): Partial<StylerConfig> {
    const numericColumns = tableMetadata.columns.filter((col: CSVColumnInfo) => col.type === 'number');
    const selectedValueColumn = numericColumns[0]?.name;
    if (selectedValueColumn === undefined) {
      throw new Error('No numeric columns found in the table');
    }
    // Return only known fields from StylerConfig
    const cfg: Partial<StylerConfig> = {
      algorithm: 'linear',
      colorSpace: 'hsv',
      targetProperty: 'fill-color', mapping: {
        min: 0,
        max: 100,
        hueStart: 0,
        hueEnd: 120,
        saturation: 0.8,
        brightness: 0.9,
      },
      enabled: true,
      valueColumn: selectedValueColumn,
      keyColumn:
        tableMetadata.columns.find((col: CSVColumnInfo) => col.name === 'id')?.name ??
        tableMetadata.columns[0]?.name,
    };
    if (cfg.valueColumn) {
      cfg.selectedValueColumn = cfg.valueColumn;
    }
    if (cfg.keyColumn) {
      cfg.selectedKeyColumn = cfg.keyColumn;
    }
    return cfg;
  }

  private ensureFullMetadata(table: CSVTableMetadataLike): CSVTableMetadata {
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
      referenceCount: table.referenceCount ?? (table.referencingPlugins?.length ?? 0),
      referencingPlugins: table.referencingPlugins ?? [],
      isChunked: table.isChunked ?? false,
      chunkCount: table.chunkCount ?? 0,
    };
  }
}
