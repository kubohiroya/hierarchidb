/**
 * @file fileProcessingUtils.test.ts
 * @description Unit tests for file processing utilities
 */

import { describe, it, expect } from 'vitest';
import { detectFileType } from './fileProcessingUtils';

describe('File Type Detection', () => {
  it('should detect CSV files correctly', () => {
    const file = new File([''], 'test.csv', { type: 'text/csv' });
    expect(detectFileType(file)).toBe('csv');
  });

  it('should detect TSV files correctly', () => {
    const file = new File([''], 'test.tsv', { type: 'text/tsv' });
    expect(detectFileType(file)).toBe('tsv');
    
    const tabFile = new File([''], 'test.tab', { type: 'text/plain' });
    expect(detectFileType(tabFile)).toBe('tsv');
  });

  it('should detect Excel files correctly', () => {
    const xlsxFile = new File([''], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    expect(detectFileType(xlsxFile)).toBe('excel');
    
    const xlsFile = new File([''], 'test.xls', { type: 'application/vnd.ms-excel' });
    expect(detectFileType(xlsFile)).toBe('excel');
    
    const xlsmFile = new File([''], 'test.xlsm', { type: 'application/vnd.ms-excel.sheet.macroEnabled.12' });
    expect(detectFileType(xlsmFile)).toBe('excel');
  });

  it('should detect ZIP files correctly', () => {
    const file = new File([''], 'test.zip', { type: 'application/zip' });
    expect(detectFileType(file)).toBe('zip');
  });

  it('should detect unsupported files correctly', () => {
    const file = new File([''], 'test.pdf', { type: 'application/pdf' });
    expect(detectFileType(file)).toBe('unsupported');
    
    const imgFile = new File([''], 'test.jpg', { type: 'image/jpeg' });
    expect(detectFileType(imgFile)).toBe('unsupported');
  });

  it('should be case insensitive for extensions', () => {
    const csvFile = new File([''], 'TEST.CSV', { type: 'text/csv' });
    expect(detectFileType(csvFile)).toBe('csv');
    
    const xlsxFile = new File([''], 'Data.XLSX', { type: 'application/excel' });
    expect(detectFileType(xlsxFile)).toBe('excel');
  });
});