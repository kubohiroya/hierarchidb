import type { YamlStorageLegacyFenceState } from './yamlStorageLegacyFenceTypes.js';

const issuedYamlStorageLegacyFenceStates = new WeakSet<object>();

export function freezeIssuedYamlStorageLegacyFenceState<T extends YamlStorageLegacyFenceState>(
  state: T
): T {
  const frozenState = Object.freeze(state);
  issuedYamlStorageLegacyFenceStates.add(frozenState);
  return frozenState;
}

export function isIssuedYamlStorageLegacyFenceState(
  value: unknown
): value is YamlStorageLegacyFenceState {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.isFrozen(value) &&
    issuedYamlStorageLegacyFenceStates.has(value)
  );
}
