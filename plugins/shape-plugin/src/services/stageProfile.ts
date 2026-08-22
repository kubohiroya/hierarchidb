import type { TaskStage } from '@hierarchidb/build-api';

export type ShapeStageKind = 'primary' | 'intermediate' | 'final';

export type ShapeCanonicalStage = TaskStage;

export type ShapeStageProfileEntry = {
  stageKey: string;
  kind: ShapeStageKind;
  canonicalStage: ShapeCanonicalStage;
  checkpointStage: string;
  description: string;
};

export type ShapeStageProfile = {
  profileId: string;
  primary: ShapeStageProfileEntry;
  intermediate: ShapeStageProfileEntry[];
  final: ShapeStageProfileEntry;
};

export const createDefaultShapeStageProfile = (): ShapeStageProfile => ({
  profileId: 'shape-default-v1',
  primary: {
    stageKey: 'primary-source',
    kind: 'primary',
    canonicalStage: 'source',
    checkpointStage: 'source-stage',
    description: 'Resolve source inputs and cache source artifacts.',
  },
  intermediate: [
    {
      stageKey: 'intermediate-geometry',
      kind: 'intermediate',
      canonicalStage: 'geometry',
      checkpointStage: 'geometry-stage',
      description: 'Build geometry artifacts from source cache.',
    },
  ],
  final: {
    stageKey: 'final-tile-emit',
    kind: 'final',
    canonicalStage: 'tileEmit',
    checkpointStage: 'tile-emit-stage',
    description: 'Emit final tile artifacts.',
  },
});

export const flattenShapeStageProfile = (profile: ShapeStageProfile): ShapeStageProfileEntry[] => [
  profile.primary,
  ...profile.intermediate,
  profile.final,
];

export const validateShapeStageProfile = (profile: ShapeStageProfile): void => {
  const entries = flattenShapeStageProfile(profile);
  if (entries.length < 2) {
    throw new Error('[shape-stage-profile] profile must include at least primary and final stages');
  }
  const seenStageKeys = new Set<string>();
  for (const entry of entries) {
    if (!entry.stageKey || entry.stageKey.trim().length === 0) {
      throw new Error('[shape-stage-profile] stageKey must be non-empty');
    }
    if (seenStageKeys.has(entry.stageKey)) {
      throw new Error(`[shape-stage-profile] duplicate stageKey: ${entry.stageKey}`);
    }
    seenStageKeys.add(entry.stageKey);
    if (!entry.checkpointStage || entry.checkpointStage.trim().length === 0) {
      throw new Error(`[shape-stage-profile] checkpointStage must be non-empty: ${entry.stageKey}`);
    }
  }
  if (profile.primary.kind !== 'primary') {
    throw new Error('[shape-stage-profile] primary.kind must be "primary"');
  }
  if (profile.final.kind !== 'final') {
    throw new Error('[shape-stage-profile] final.kind must be "final"');
  }
  if (profile.intermediate.some((entry) => entry.kind !== 'intermediate')) {
    throw new Error('[shape-stage-profile] intermediate entries must use kind "intermediate"');
  }
};
