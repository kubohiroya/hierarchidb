import { describe, expect, it } from 'vitest';
import {
  createDefaultShapeStageProfile,
  flattenShapeStageProfile,
  validateShapeStageProfile,
} from '~/services/stageProfile';

describe('stageProfile', () => {
  it('provides ordered primary -> intermediate* -> final stages', () => {
    const profile = createDefaultShapeStageProfile();
    const stages = flattenShapeStageProfile(profile);
    expect(stages[0]?.kind).toBe('primary');
    expect(stages.at(-1)?.kind).toBe('final');
    expect(stages.map((stage) => stage.stageKey)).toEqual([
      'primary-source',
      'intermediate-geometry',
      'final-tile-emit',
    ]);
  });

  it('accepts the default profile', () => {
    const profile = createDefaultShapeStageProfile();
    expect(() => validateShapeStageProfile(profile)).not.toThrow();
  });

  it('rejects duplicate stage keys', () => {
    const profile = createDefaultShapeStageProfile();
    profile.intermediate = [
      {
        ...profile.intermediate[0]!,
        stageKey: profile.primary.stageKey,
      },
    ];
    expect(() => validateShapeStageProfile(profile)).toThrow(/duplicate stageKey/i);
  });
});
