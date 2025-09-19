/**
 * @file definition.ts
 * @description Shape plugin extension definition
 *
 * This file defines the Shape plugin as an extension of the Folder plugin,
 * adding geographic shape-plugin data functionality while inheriting basic name/description fields.
 *
 * Extension Hierarchy:
 * FolderPlugin (Step 1: Name/Description)
 * -> ShapePlugin (Step 2: Data Source, Step 3: License, Step 4: Processing, Step 5: Country Selection)
 */

// Step Components
import { DataSourceStep } from './components/DataSourceStep.js';
import { LicenseStep } from './components/LicenseStep.js';
import { ProcessingStep } from './components/ProcessingStep.js';
import { CountrySelectionStep } from './components/CountrySelectionStep.js';

/**
 * Shape Plugin Extension Definition
 * Extends the Folder plugin with geographic shape-plugin data functionality
 */
export const ShapeExtension = {
  // 1. Base plugin extension
  extends: 'folder',

  // 2. Plugin metadata
  nodeType: 'shape',
  name: 'Shape',
  displayName: 'Geographic Shapes',
  icon: 'place',
  color: '#4CAF50',

  // 3. Extended base-dialog steps
  // Step 1 (Name/Description) is automatically inherited from folder-plugin
  extendedSteps: [
    {
      stepNumber: 2,
      title: 'Data Source',
      component: DataSourceStep,
      validation: {
        validate: async (data: any) => {
          if (!data.dataSourceName) {
            return { isValid: false, errors: ['Data source selection is required'] };
          }
          return { isValid: true, errors: [] };
        },
      },
    },
    {
      stepNumber: 3,
      title: 'License Agreement',
      component: LicenseStep,
      dependsOn: [2], // Depends on Data Source step
      validation: {
        validate: async (data: any) => {
          if (!data.licenseAgreement) {
            return {
              isValid: false,
              errors: ['You must accept the license agreement to proceed'],
            };
          }
          return { isValid: true, errors: [] };
        },
      },
    },
    {
      stepNumber: 4,
      title: 'Processing Configuration',
      component: ProcessingStep,
      dependsOn: [3], // Depends on License step
      validation: {
        validate: async (data: any) => {
          const errors: string[] = [];

          if (!data.selectedAdminLevels || data.selectedAdminLevels.length === 0) {
            errors.push('At least one administrative level must be selected');
          }

          if (data.selectedAdminLevels?.some((level: number) => level < 0 || level > 3)) {
            errors.push('Administrative levels must be between 0 and 3');
          }

          return {
            isValid: errors.length === 0,
            errors,
          };
        },
      },
    },
    {
      stepNumber: 5,
      title: 'Country Selection',
      component: CountrySelectionStep,
      dependsOn: [4], // Depends on Processing step
      validation: {
        validate: async (data: any) => {
          if (!data.selectedCountries || data.selectedCountries.length === 0) {
            return {
              isValid: false,
              errors: ['At least one country must be selected'],
            };
          }
          return { isValid: true, errors: [] };
        },
      },
    },
  ],

  // 4. Extended entity fields
  extendedFields: [
    {
      name: 'dataSourceName',
      type: 'string',
      required: true,
      label: 'Data Source',
      description: 'Geographic data source provider',
    },
    {
      name: 'selectedCountries',
      type: 'array',
      required: true,
      label: 'Selected Countries',
      description: 'List of country codes for geographic data',
    },
    {
      name: 'selectedAdminLevels',
      type: 'array',
      required: true,
      label: 'Administrative Levels',
      description: 'Administrative division levels (0-3)',
    },
    {
      name: 'licenseAgreement',
      type: 'boolean',
      required: true,
      label: 'License Agreement',
      description: 'Acceptance of data usage license',
    },
    {
      name: 'batchConfig',
      type: 'object',
      required: false,
      label: 'Batch Configuration',
      description: 'Configuration for batch processing operations',
    },
  ],

  // 5. Extended validation
  extendedValidation: {
    extendedRules: {
      dataSourceValidation: {
        validate: (data: any) => {
          const allowedSources = ['geofabrik', 'naturalearth', 'gadm', 'osm'];
          return allowedSources.includes(data.dataSourceName);
        },
        message: 'Data source must be one of: geofabrik, naturalearth, gadm, osm',
      },
      adminLevelsValidation: {
        validate: (data: any) => {
          if (!Array.isArray(data.selectedAdminLevels)) return false;
          return data.selectedAdminLevels.every(
            (level: number) => typeof level === 'number' && level >= 0 && level <= 3,
          );
        },
        message: 'Administrative levels must be numbers between 0 and 3',
      },
      countriesValidation: {
        validate: (data: any) => {
          if (!Array.isArray(data.selectedCountries)) return false;
          return data.selectedCountries.every(
            (country: string) => typeof country === 'string' && country.length >= 2,
          );
        },
        message: 'Country codes must be valid strings',
      },
      licenseValidation: {
        validate: (data: any) => {
          return data.licenseAgreement === true;
        },
        message: 'License agreement must be accepted',
      },
    },
    chainMode: 'all',
    mergeStrategy: 'append', // Append to folder-plugin's base validation
  },
};
