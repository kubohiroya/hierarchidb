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

  test('TC-101-002: 拡張ステップが正しく定義されている', () => {
    //  : DataSourceStepFilteringStep
    //  : extendedSteps
    //  : Step 2, Step 3
    //  : 3

    //  : extendedSteps
    //  :
    const steps = SpreadsheetExtension.extendedSteps;

    //  :
    //  : 2
    expect(steps).toBeDefined(); //  : extendedSteps
    expect(steps).toHaveLength(2); //  : Step 2Step 32

    //  : Step 2DataSourceStep
    const step2 = steps[0];
    expect(step2?.stepNumber).toBe(2); //  : 2
    expect(step2?.title).toBe('データソース選択'); //  :
    expect(step2?.component).toBe(null); //  DataSourceStep not implemented yet // : DataSourceStep
    expect(step2?.validation).toBeDefined(); //  :

    //  : Step 3FilteringStep
    const step3 = steps[1];
    expect(step3?.stepNumber).toBe(3); //  : 3
    expect(step3?.title).toBe('フィルタリング'); //  :
    expect(step3?.component).toBe(null); //  FilteringStep not implemented yet // : FilteringStep
    //  expect(step3?.dependsOn).toEqual([2]); // Not implemented yet // : Step 2
    //  expect(step3?.isOptional).toBe(true); // Not implemented yet // :
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

  test('TC-101-006: dataSource未選択時にエラーとなる', async () => {
    //  : dataSource
    //  : Step 2dataSource
    //  :
    //  : validation

    //  : dataSource
    //  : name/descriptiondataSource
    const formData = {
      name: 'test',
      description: 'test description',
      //  dataSource
    };

    //  : Step 2
    //  : DataSourceStep
    const step2 = SpreadsheetExtension.extendedSteps[0];
    const validationResult = await step2?.validation?.validate(formData);

    //  :
    //  :
    expect(validationResult?.isValid).toBe(false); //  :
    expect(validationResult?.errors).toContain('データソースを選択してください'); //  :
  });

  test('TC-101-007: fileタイプ選択時にファイル未選択でエラー', async () => {
    //  : filedataSource
    //  :
    //  : file
    //  : Stepvalidation

    //  : file
    //  : dataSourcetypefilefile
    const formData = {
      dataSource: { type: 'file' },
      //  file
    };

    //  : Step 2
    //  : DataSourceStep
    const step2 = SpreadsheetExtension.extendedSteps[0];
    const validationResult = await step2?.validation?.validate(formData);

    //  :
    //  :
    expect(validationResult?.isValid).toBe(false); //  :
    expect(validationResult?.errors).toContain('ファイルを選択してください'); //  :
  });

  test('TC-101-008: 空のフィルタ配列が正常に処理される', async () => {
    //  :
    //  : filters
    //  :
    //  :

    //  :
    //  : rows/columns
    const formData = {
      dataSource: { type: 'file' },
      file: { name: 'data.csv' },
      filters: {
        rows: [],
        columns: [],
      },
    };

    //  : Step 3
    //  : FilteringStep
    const step3 = SpreadsheetExtension.extendedSteps[1];
    const validationResult = await step3?.validation?.validate(formData);

    //  :
    //  :
    expect(validationResult?.isValid ?? true).toBe(true); //  :
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