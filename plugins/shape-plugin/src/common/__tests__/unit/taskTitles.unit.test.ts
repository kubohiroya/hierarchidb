import { describe, expect, it } from 'vitest';
import { buildShapeTaskTitle } from '../../utils/taskTitleUtils';

describe('taskTitles', () => {
  it('formats geometry task title as country/admin and band/zoom summary', () => {
    const title = buildShapeTaskTitle({
      stage: 'geometry',
      inputData: {
        countryName: 'Japan',
        countryCode: 'JP',
        adminLevel: 0,
        bandIndex: 2,
        bandMinZoom: 3,
        bandMaxZoom: 6,
      },
    });

    expect(title).toBe('Japan (JP) Admin0 / band 2 z3-6');
  });

  it('rebuilds geometry title even when explicit title exists', () => {
    const title = buildShapeTaskTitle({
      stage: 'geometry',
      title: 'Custom title',
      inputData: {
        countryName: 'Japan',
        countryCode: 'JP',
        adminLevel: 0,
        bandIndex: 2,
        bandMinZoom: 3,
        bandMaxZoom: 6,
      },
    });

    expect(title).toBe('Japan (JP) Admin0 / band 2 z3-6');
  });

  it('builds source title from metadata.preview when inputData is missing', () => {
    const title = buildShapeTaskTitle({
      stage: 'source',
      metadata: {
        preview: {
          sourceCountryName: 'Japan',
          sourceCountryCode: 'JP',
          adminLevel: 0,
        },
      },
    });

    expect(title).toBe('Japan (JP) Admin0');
  });

  it('does not duplicate ISO code as both name and code in geometry title', () => {
    const title = buildShapeTaskTitle({
      stage: 'geometry',
      inputData: {
        countryName: 'AND',
        countryCode: 'AND',
        adminLevel: 1,
        bandIndex: 0,
        bandMinZoom: 1,
        bandMaxZoom: 2,
      },
    });

    expect(title).toBe('AND Admin1 / band 0 z1-2');
  });

  it('resolves localized country name from code when the source name is only a code token', () => {
    const title = buildShapeTaskTitle(
      {
        stage: 'geometry',
        inputData: {
          countryName: 'AND',
          countryCode: 'AND',
          adminLevel: 1,
          bandIndex: 0,
          bandMinZoom: 1,
          bandMaxZoom: 2,
        },
      },
      {
        resolveCountryNameByCode: (code) => (code === 'AND' ? 'Andorra' : undefined),
      }
    );

    expect(title).toBe('Andorra (AND) Admin1 / band 0 z1-2');
  });

  it('includes zoom range when geometry task uses zMin/zMax fields', () => {
    const title = buildShapeTaskTitle({
      stage: 'geometry',
      inputData: {
        countryName: 'Japan',
        countryCode: 'JP',
        adminLevel: 0,
        bandIndex: 1,
        zMin: 2,
        zMax: 5,
      },
    });

    expect(title).toBe('Japan (JP) Admin0 / band 1 z2-5');
  });

  it('throws when geometry task misses zoom range required for title', () => {
    expect(() =>
      buildShapeTaskTitle({
        stage: 'geometry',
        inputData: {
          countryName: 'Japan',
          countryCode: 'JP',
          adminLevel: 0,
          bandIndex: 1,
        },
      })
    ).toThrow('[shape-plugin] geometry task title requires bandMinZoom and bandMaxZoom');
  });
});
