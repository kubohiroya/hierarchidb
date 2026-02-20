import { describe, expect, it } from 'vitest';
import { MappingCompiler } from '../../../../services/SimpleMappingCompiler.ts';

describe('SimpleMappingCompiler', () => {
  it('should handle basic transformations', () => {
    const compiler = new MappingCompiler();

    const rules = [
      {
        id: 'rule1',
        sourceProperty: 'placeType',
        targetProperty: 'category',
        transformFunction: `value === 'metropolis' ? 'city' : value === 'town' ? 'town' : 'other'`,
        isRequired: true,
        defaultValue: 'other',
      },
    ];

    const compiledFn = compiler.compile(rules);

    const data1 = { placeType: 'metropolis' };
    const result1 = compiledFn(data1);
    expect(result1.category).toBe('city');

    const data2 = { placeType: 'town' };
    const result2 = compiledFn(data2);
    expect(result2.category).toBe('town');

    const data3 = { placeType: 'village' };
    const result3 = compiledFn(data3);
    expect(result3.category).toBe('other');
  });

  it('should handle nested paths', () => {
    const compiler = new MappingCompiler();

    const rules = [
      {
        id: 'rule1',
        sourceProperty: 'metrics.economic.gdp',
        targetProperty: 'gdpLevel',
        transformFunction: `value > 1000000000000 ? 'very-high' : value > 100000000000 ? 'high' : value > 10000000000 ? 'medium' : 'low'`,
        isRequired: true,
        defaultValue: 'unknown',
      },
    ];

    const compiledFn = compiler.compile(rules);

    const data = {
      metrics: {
        economic: {
          gdp: 500000000000,
        },
      },
    };

    const result = compiledFn(data);
    expect(result.gdpLevel).toBe('high');
  });

  it('should handle array transformations', () => {
    const compiler = new MappingCompiler();

    const rules = [
      {
        id: 'rule1',
        sourceProperty: 'location',
        targetProperty: 'coordinates',
        transformFunction: `[value.lon, value.lat]`,
        isRequired: true,
        defaultValue: undefined,
      },
    ];

    const compiledFn = compiler.compile(rules);

    const data = {
      location: {
        lat: 35.6895,
        lon: 139.6917,
      },
    };

    const result = compiledFn(data);
    expect(result.coordinates).toEqual([139.6917, 35.6895]);
  });
});
