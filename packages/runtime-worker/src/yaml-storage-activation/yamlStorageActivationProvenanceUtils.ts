import type { YamlStorageActivationState } from './yamlStorageActivationTypes.js';

const issuedYamlStorageActivationStates = new WeakSet<object>();

export function freezeIssuedYamlStorageActivationState<T extends YamlStorageActivationState>(
  state: T
): T {
  const frozenState = Object.freeze(state);
  issuedYamlStorageActivationStates.add(frozenState);
  return frozenState;
}

export function isIssuedYamlStorageActivationState(
  value: unknown
): value is YamlStorageActivationState {
  return (
    typeof value === 'object' && value !== null && issuedYamlStorageActivationStates.has(value)
  );
}
