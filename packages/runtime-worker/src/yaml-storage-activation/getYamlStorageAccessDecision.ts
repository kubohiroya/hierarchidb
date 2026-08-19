import type {
  YamlStorageAccessDecision,
  YamlStorageAccessRequest,
  YamlStorageActivationState,
} from './yamlStorageActivationTypes.js';
import { isIssuedYamlStorageActivationState } from './yamlStorageActivationProvenanceUtils.js';

type OwnDataProperty =
  | Readonly<{ readonly found: false }>
  | Readonly<{ readonly found: true; readonly value: unknown }>;

function readOwnDataProperty(value: object, key: PropertyKey): OwnDataProperty {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (descriptor === undefined || !Object.hasOwn(descriptor, 'value')) {
    return { found: false };
  }
  return { found: true, value: descriptor.value };
}

function isRuntimeOperation(value: unknown): value is YamlStorageAccessRequest['operation'] {
  return value === 'query' || value === 'mutation' || value === 'reader' || value === 'writer';
}

export function isYamlStorageActualFenceEstablished(state: YamlStorageActivationState): boolean {
  if (!isIssuedYamlStorageActivationState(state)) {
    return false;
  }
  if (state.phase === 'rejected') {
    return state.actualFenceEstablished;
  }
  return (
    state.phase === 'versionchanging' ||
    state.phase === 'initializing' ||
    state.phase === 'canonical-ready'
  );
}

export function getYamlStorageAccessDecision(
  state: YamlStorageActivationState,
  request: YamlStorageAccessRequest
): YamlStorageAccessDecision {
  if (!isIssuedYamlStorageActivationState(state)) {
    return Object.freeze({ allowed: false, code: 'INVALID_ACTIVATION_STATE' });
  }

  try {
    if (typeof request !== 'object' || request === null || Array.isArray(request)) {
      return Object.freeze({ allowed: false, code: 'INVALID_ACCESS_REQUEST' });
    }

    const prototype = Object.getPrototypeOf(request);
    if (prototype !== Object.prototype && prototype !== null) {
      return Object.freeze({ allowed: false, code: 'INVALID_ACCESS_REQUEST' });
    }
    const ownKeys = Reflect.ownKeys(request);
    if (
      ownKeys.some((key) => {
        const property = readOwnDataProperty(request, key);
        return property.found === false;
      })
    ) {
      return Object.freeze({ allowed: false, code: 'INVALID_ACCESS_REQUEST' });
    }

    const domainProperty = readOwnDataProperty(request, 'domain');
    const operationProperty = readOwnDataProperty(request, 'operation');
    if (
      domainProperty.found === false ||
      operationProperty.found === false ||
      !isRuntimeOperation(operationProperty.value)
    ) {
      return Object.freeze({ allowed: false, code: 'INVALID_ACCESS_REQUEST' });
    }

    if (domainProperty.value === 'yaml-db') {
      if (ownKeys.length !== 2 || ownKeys.some((key) => key !== 'domain' && key !== 'operation')) {
        return Object.freeze({ allowed: false, code: 'INVALID_ACCESS_REQUEST' });
      }
      return Object.freeze({ allowed: false, code: 'YAML_DB_UNAVAILABLE' });
    }
    if (domainProperty.value !== 'runtime') {
      return Object.freeze({ allowed: false, code: 'INVALID_ACCESS_REQUEST' });
    }

    const representationProperty = readOwnDataProperty(request, 'representation');
    if (
      ownKeys.length !== 3 ||
      ownKeys.some((key) => key !== 'domain' && key !== 'representation' && key !== 'operation') ||
      representationProperty.found === false ||
      (representationProperty.value !== 'legacy' && representationProperty.value !== 'canonical')
    ) {
      return Object.freeze({ allowed: false, code: 'INVALID_ACCESS_REQUEST' });
    }
    if (representationProperty.value === 'legacy') {
      return Object.freeze({ allowed: false, code: 'LEGACY_RUNTIME_UNAVAILABLE' });
    }
    if (state.phase === 'canonical-ready') {
      return Object.freeze({ allowed: true, code: 'CANONICAL_READY' });
    }
    if (state.phase === 'rejected') {
      return Object.freeze({ allowed: false, code: 'ACTIVATION_REJECTED' });
    }
    return Object.freeze({ allowed: false, code: 'ACTIVATION_IN_PROGRESS' });
  } catch {
    return Object.freeze({ allowed: false, code: 'INVALID_ACCESS_REQUEST' });
  }
}
