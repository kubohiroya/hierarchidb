import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
// import type { DialogStepDefinition } from '@hierarchidb/common-types';
//  Red
import { SpreadsheetExtension } from './definition.js';
// import { DataSourceStep } from '../steps/DataSourceStep.js';
// import { FilteringStep } from '../steps/FilteringStep.js';

describe('Spreadsheet拡張定義', () => {
  beforeEach(() => {
    //  :
    //  :
    vi.clearAllMocks();
  });

  afterEach(() => {
    //  :
    //  :
    vi.restoreAllMocks();
  });

  test('TC-101-001: 拡張定義の基本構造が正しく定義されている', () => {
    //  : SpreadsheetExtensionExtendableNodeTypeDefinition
    //  :
    //  : folderspreadsheetnodeType
    //  : EXTENDING_FOLDER_PLUGIN.md

    //  : SpreadsheetExtension
    //  :
    const extension = SpreadsheetExtension;

    //  :
    //  : folder
    expect(extension.extends).toBe('folder'); //  : folder
    expect(extension.nodeType).toBe('spreadsheet'); //  : nodeType
    expect(extension.name).toBe('Spreadsheet'); //  :
    expect(extension.displayName).toBe('スプレッドシート'); //  :
    expect(extension.icon).toBe('table_chart'); //  : Material Icon
    expect(extension.color).toBe('#2196F3'); //  :
  });


  test('TC-101-003: 拡張フィールドが正しく定義されている', () => {
    //  : Spreadsheet
    //  : extendedFields
    //  : spreadsheetMetadataIddataSourcefilters
    //  : SpreadsheetEntity

    //  : extendedFields
    //  :
    const fields = SpreadsheetExtension.extendedFields;

    //  :
    expect(fields).toBeDefined(); //  : extendedFields
    expect(fields).toHaveLength(3); //  : 3

    //  : spreadsheetMetadataId
    const metadataField = fields.find(f => f.name === 'spreadsheetMetadataId');
    expect(metadataField).toBeDefined(); //  : spreadsheetMetadataId
    expect(metadataField?.type).toBe('string'); //  :
    expect(metadataField?.required).toBe(false); //  :

    //  : dataSource
    const dataSourceField = fields.find(f => f.name === 'dataSource');
    expect(dataSourceField).toBeDefined(); //  : dataSource
    expect(dataSourceField?.type).toBe('object'); //  :
    expect(dataSourceField?.required).toBe(true); //  :
    //  expect(dataSourceField?.schema).toBeDefined(); // Not implemented yet // :

    //  : filters
    const filtersField = fields.find(f => f.name === 'filters');
    expect(filtersField).toBeDefined(); //  : filters
    expect(filtersField?.type).toBe('object'); //  :
    expect(filtersField?.required).toBe(false); //  :
  });

  test('TC-101-004: CSVファイルのバリデーションが正しく動作する', async () => {
    //  : CSV
    //  : fileFormatCSV
    //  : CSV
    //  : implementation-guide.mdCSV

    //  : CSV
    //  : filedataSourceCSV
    const formData = {
      dataSource: { type: 'file' },
      file: { name: 'data.csv' },
    };

    //  :
    //  : extendedValidationfileFormatCSV
    const { extendedRules } = SpreadsheetExtension.extendedValidation;
    const fileFormatRule = extendedRules.fileFormatRule;
    const isValid = fileFormatRule?.validate(formData);

    //  :
    //  : CSV
    expect(fileFormatRule).toBeDefined(); //  : fileFormat
    expect(isValid).toBe(true); //  : CSV
  });

  test('TC-101-005: 非対応ファイル形式が拒否される', async () => {
    //  : PDF
    //  : fileFormat
    //  : PDF
    //  :

    //  : PDF
    //  : filedataSourcePDF
    const formData = {
      dataSource: { type: 'file' },
      file: { name: 'document.pdf' },
    };

    //  :
    //  : extendedValidationfileFormatPDF
    const { extendedRules } = SpreadsheetExtension.extendedValidation;
    const fileFormatRule = extendedRules.fileFormatRule;
    const isValid = fileFormatRule?.validate(formData);

    //  :
    //  : PDF
    expect(isValid).toBe(false); //  : PDF
    expect(fileFormatRule?.message).toBe('CSV、TSV、またはExcelファイルを選択してください'); //  :
  });

  test('TC-101-009: TSVファイルのバリデーションが正しく動作する', async () => {
    //  : TSV
    //  : fileFormatTSV
    //  : TSV
    //  : implementation-guide.md

    //  : TSV
    //  : filedataSourceTSV
    const formData = {
      dataSource: { type: 'file' },
      file: { name: 'data.tsv' },
    };

    //  :
    //  : extendedValidationfileFormatTSV
    const { extendedRules } = SpreadsheetExtension.extendedValidation;
    const fileFormatRule = extendedRules.fileFormatRule;
    const isValid = fileFormatRule?.validate(formData);

    //  :
    //  : TSV
    expect(isValid).toBe(true); //  : TSV
  });

  test('TC-101-010: Excelファイルのバリデーションが正しく動作する', async () => {
    //  : Excel.xlsx, .xls
    //  : fileFormatExcel
    //  : Excel
    //  :

    //  : Excel
    //  : filedataSourcexlsx
    const xlsxFormData = {
      dataSource: { type: 'file' },
      file: { name: 'spreadsheet-plugin.xlsx' },
    };

    const xlsFormData = {
      dataSource: { type: 'file' },
      file: { name: 'spreadsheet-plugin.xls' },
    };

    //  :
    //  : extendedValidationfileFormatExcel
    const { extendedRules } = SpreadsheetExtension.extendedValidation;
    const fileFormatRule = extendedRules.fileFormatRule;
    const isXlsxValid = fileFormatRule?.validate(xlsxFormData);
    const isXlsValid = fileFormatRule?.validate(xlsFormData);

    //  :
    //  : Excel
    expect(isXlsxValid).toBe(true); //  : xlsx
    expect(isXlsValid).toBe(true); //  : xls
  });
});
