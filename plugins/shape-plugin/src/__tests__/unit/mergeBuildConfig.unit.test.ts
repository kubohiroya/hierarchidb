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
});
