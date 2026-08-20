import { isIssuedYamlStorageLegacyFenceState } from './yamlStorageLegacyFenceProvenanceUtils.js';
import type { YamlStorageLegacyFenceDecision } from './yamlStorageLegacyFenceTypes.js';

export function getYamlStorageLegacyFenceDecision(
  stateValue: unknown
): YamlStorageLegacyFenceDecision {
  if (!isIssuedYamlStorageLegacyFenceState(stateValue)) {
    return Object.freeze({
      readyForPreflight: false,
      actualFenceEstablished: false,
      code: 'INVALID_LEGACY_FENCE_STATE',
    });
  }
  if (stateValue.phase === 'ready-for-preflight') {
    return Object.freeze({
      readyForPreflight: true,
      actualFenceEstablished: false,
      code: 'READY_FOR_PREFLIGHT',
    });
  }
  return Object.freeze({
    readyForPreflight: false,
    actualFenceEstablished: false,
    code: stateValue.phase === 'rejected' ? 'QUIESCENCE_REJECTED' : 'QUIESCENCE_IN_PROGRESS',
  });
}
