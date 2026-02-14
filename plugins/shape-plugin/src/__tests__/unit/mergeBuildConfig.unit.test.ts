import { describe, expect, it } from 'vitest';
import { DEFAULT_BUILD_CONFIG } from '../../common/types/constants.js';
import { mergeBuildConfig } from '../../services/utils/utils.js';
import type { ShapeBuildConfig } from '../../common/types/index.js';

describe('mergeBuildConfig', () => {
  it('preserves omitDetailsConfig.level when override provides empty omitDetailsConfig object', () => {
    const merged = mergeBuildConfig(
      DEFAULT_BUILD_CONFIG,
      {
        transformConfig: {
          omitDetailsConfig: {},
        },
      } as unknown as Partial<ShapeBuildConfig>,
    );

    expect(merged.transformConfig.omitDetailsConfig.level).toBe(
      DEFAULT_BUILD_CONFIG.transformConfig.omitDetailsConfig.level,
    );
  });

  it('applies omitDetailsConfig.level override when a valid level is provided', () => {
    const merged = mergeBuildConfig(DEFAULT_BUILD_CONFIG, {
      transformConfig: {
        omitDetailsConfig: {
          level: 'weak',
        },
      },
    });

    expect(merged.transformConfig.omitDetailsConfig.level).toBe('weak');
  });

  it('normalizes legacy omitDetailsConfig level aliases from persisted drafts', () => {
    const mergedFromNone = mergeBuildConfig(
      DEFAULT_BUILD_CONFIG,
      {
        transformConfig: {
          omitDetailsConfig: {
            level: 'none',
          },
        },
      } as unknown as Partial<ShapeBuildConfig>,
    );
    const mergedFromModerate = mergeBuildConfig(
      DEFAULT_BUILD_CONFIG,
      {
        transformConfig: {
          omitDetailsConfig: {
            level: 'moderate',
          },
        },
      } as unknown as Partial<ShapeBuildConfig>,
    );

    expect(mergedFromNone.transformConfig.omitDetailsConfig.level).toBe('weak');
    expect(mergedFromModerate.transformConfig.omitDetailsConfig.level).toBe('medium');
  });

  it('throws for unsupported omitDetailsConfig level values', () => {
    expect(() =>
      mergeBuildConfig(
        DEFAULT_BUILD_CONFIG,
        {
          transformConfig: {
            omitDetailsConfig: {
              level: 'invalid-level',
            },
          },
        } as unknown as Partial<ShapeBuildConfig>,
      ),
    ).toThrow('unsupported omit-details level: invalid-level');
  });
});
