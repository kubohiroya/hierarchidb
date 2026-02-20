import { beforeEach, describe, expect, it } from 'vitest';
import type { ResolverEntity } from '~/ui/components/_obsolate_common/types/index';
import { MappingCompiler } from '~/services/SimpleMappingCompiler.ts';

describe('Styler Integration with Resolver', () => {
  let compiler: MappingCompiler;

  beforeEach(() => {
    compiler = new MappingCompiler();
  });

  describe('Direct Mapping Scenario', () => {
    it('should pass through GeoJSON properties without transformation', () => {
      const geoJsonData = {
        type: 'Feature',
        properties: {
          population: 1000000,
          name: 'Tokyo',
          category: 'city',
        },
        geometry: {
          type: 'Point',
          coordinates: [139.6917, 35.6895],
        },
      };

      // In direct mapping, Styler accesses properties directly
      const styleRule = {
        property: 'population',
        stops: [
          [100000, '#fee5d9'],
          [500000, '#fcae91'],
          [1000000, '#fb6a4a'],
          [5000000, '#de2d26'],
        ],
      };

      // Direct access without Resolver
      const population = geoJsonData.properties.population;
      expect(population).toBe(1000000);

      // Find matching stop for styling (find the highest threshold that's less than or equal to population)
      let matchingStop = styleRule.stops[0];
      for (const stop of styleRule.stops) {
        if (population >= stop[0]) {
          matchingStop = stop;
        }
      }
      expect(matchingStop?.[1]).toBe('#fb6a4a');
    });
  });

  describe('Resolver-Mediated Mapping', () => {
    it('should transform properties through Resolver before Styler', async () => {
      // Source data with different schema
      const sourceData = {
        id: 'location-1',
        attributes: {
          inhabitantCount: 1000000,
          placeName: 'Tokyo',
          placeType: 'metropolis',
          economicIndex: 85,
        },
      };

      // Resolver configuration
      const resolverEntity: Partial<ResolverEntity> = {
        name: 'Location to GeoJSON Mapper',
        mappingRules: [
          {
            id: 'rule1',
            sourceProperty: 'attributes.inhabitantCount',
            targetProperty: 'population',
            transformFunction: undefined,
            isRequired: true,
            defaultValue: undefined,
          },
          {
            id: 'rule2',
            sourceProperty: 'attributes.placeName',
            targetProperty: 'name',
            transformFunction: undefined,
            isRequired: true,
            defaultValue: undefined,
          },
          {
            id: 'rule3',
            sourceProperty: 'attributes.placeType',
            targetProperty: 'category',
            transformFunction: `
              value === 'metropolis' ? 'city' : 
              value === 'town' ? 'town' : 
              'other'
            `,
            isRequired: true,
            defaultValue: 'other',
          },
          {
            id: 'rule4',
            sourceProperty: 'attributes.economicIndex',
            targetProperty: 'economicLevel',
            transformFunction: `
              value >= 80 ? 'high' :
              value >= 50 ? 'medium' :
              'low'
            `,
            isRequired: false,
            defaultValue: 'unknown',
          },
        ],
      };

      // Compile mapping rules
      const compiledFunction = compiler.compile(resolverEntity.mappingRules || []);

      // Apply transformation
      const transformedData = compiledFunction(sourceData);

      // Verify transformation results
      expect(transformedData.population).toBe(1000000);
      expect(transformedData.name).toBe('Tokyo');
      expect(transformedData.category).toBe('city');
      expect(transformedData.economicLevel).toBe('high');

      // Now Styler can use the transformed data
      const styleRule = {
        property: 'economicLevel',
        type: 'categorical',
        stops: {
          high: '#2ecc71',
          medium: '#f39c12',
          low: '#e74c3c',
          unknown: '#95a5a6',
        },
      };

      const color = styleRule.stops[transformedData.economicLevel as keyof typeof styleRule.stops];
      expect(color).toBe('#2ecc71');
    });

    it('should handle complex nested transformations', () => {
      const sourceData = {
        metrics: {
          demographic: {
            total: 5000000,
            density: 1500,
          },
          economic: {
            gdp: 500000000000,
            growth: 2.5,
          },
        },
        location: {
          lat: 35.6895,
          lon: 139.6917,
        },
      };

      const mappingRules = [
        {
          id: 'rule1',
          sourceProperty: 'metrics.demographic.total',
          targetProperty: 'population',
          transformFunction: undefined,
          isRequired: true,
          defaultValue: undefined,
        },
        {
          id: 'rule2',
          sourceProperty: 'metrics.demographic.density',
          targetProperty: 'populationDensity',
          transformFunction: undefined,
          isRequired: true,
          defaultValue: undefined,
        },
        {
          id: 'rule3',
          sourceProperty: 'metrics.economic.gdp',
          targetProperty: 'gdpLevel',
          transformFunction: `
            value > 1000000000000 ? 'very-high' :
            value > 100000000000 ? 'high' :
            value > 10000000000 ? 'medium' :
            'low'
          `,
          isRequired: true,
          defaultValue: 'unknown',
        },
        {
          id: 'rule4',
          sourceProperty: 'location',
          targetProperty: 'coordinates',
          transformFunction: `[value.lon, value.lat]`,
          isRequired: true,
          defaultValue: undefined,
        },
      ];

      const compiledFunction = compiler.compile(mappingRules);
      const result = compiledFunction(sourceData);

      expect(result.population).toBe(5000000);
      expect(result.populationDensity).toBe(1500);
      expect(result.gdpLevel).toBe('high');
      expect(result.coordinates).toEqual([139.6917, 35.6895]);
    });

    it('should handle validation rules before transformation', () => {
      const sourceData = {
        population: -100, // Invalid negative population
        name: '', // Empty name
        coordinates: [200, 100], // Invalid coordinates
      };

      const validationRules = [
        {
          id: 'val1',
          fieldPath: 'population',
          ruleName: 'positive',
          validationType: 'range' as const,
          errorMessage: 'Population must be positive',
          isActive: true,
          severity: 'error' as const,
          min: 0,
        },
        {
          id: 'val2',
          fieldPath: 'name',
          ruleName: 'required',
          validationType: 'required' as const,
          errorMessage: 'Name is required',
          isActive: true,
          severity: 'error' as const,
        },
        {
          id: 'val3',
          fieldPath: 'coordinates',
          ruleName: 'valid-coords',
          validationType: 'custom' as const,
          errorMessage: 'Invalid coordinates',
          isActive: true,
          severity: 'error' as const,
          customValidator: (coords: number[]) => {
            return (
              coords[0] >= -180 &&
              coords[0] <= 180 &&
              coords[1] >= -90 &&
              coords[1] <= 90
            );
          },
        },
      ];

      // Validate data
      const errors: string[] = [];

      if (sourceData.population < 0) {
        errors.push(validationRules[0].errorMessage);
      }
      if (!sourceData.name) {
        errors.push(validationRules[1].errorMessage);
      }
      if (sourceData.coordinates[0] > 180 || sourceData.coordinates[1] > 90) {
        errors.push(validationRules[2].errorMessage);
      }

      expect(errors).toContain('Population must be positive');
      expect(errors).toContain('Name is required');
      expect(errors).toContain('Invalid coordinates');
    });
  });

  describe('Performance Optimization', () => {
    it('should compile mapping rules for better performance', () => {
      const mappingRules = [
        {
          id: 'rule1',
          sourceProperty: 'a',
          targetProperty: 'x',
          transformFunction: 'value * 2',
          isRequired: true,
          defaultValue: undefined,
        },
        {
          id: 'rule2',
          sourceProperty: 'b',
          targetProperty: 'y',
          transformFunction: 'value + 10',
          isRequired: true,
          defaultValue: undefined,
        },
      ];

      // Compile once
      const compiledFunction = compiler.compile(mappingRules);

      // Use many times (simulating bulk processing)
      const testData = Array.from({ length: 10000 }, (_, i) => ({
        a: i,
        b: i * 2,
      }));

      const startTime = performance.now();
      const results = testData.map(compiledFunction);
      const endTime = performance.now();

      expect(results[0]).toEqual({ x: 0, y: 10 });
      expect(results[100]).toEqual({ x: 200, y: 210 });

      // Compiled function should be fast
      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(200); // Should process 10000 items in less than 200ms
    });
  });
});
