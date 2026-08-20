type OwnDataProperty =
  | Readonly<{ readonly found: false }>
  | Readonly<{ readonly found: true; readonly value: unknown }>;

export function readYamlStorageLegacyFenceOwnDataProperty(
  value: object,
  key: PropertyKey
): OwnDataProperty {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (descriptor === undefined || !Object.hasOwn(descriptor, 'value')) {
    return { found: false };
  }
  return { found: true, value: descriptor.value };
}

export function hasExactYamlStorageLegacyFenceObjectKeys(
  value: unknown,
  expectedKeys: readonly string[]
): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return false;
  }
  const ownKeys = Reflect.ownKeys(value);
  if (
    ownKeys.length !== expectedKeys.length ||
    ownKeys.some((key) => typeof key !== 'string' || !expectedKeys.includes(key))
  ) {
    return false;
  }
  return expectedKeys.every((key) => readYamlStorageLegacyFenceOwnDataProperty(value, key).found);
}

export function readExactYamlStorageLegacyFenceArray(value: unknown): readonly unknown[] | null {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    return null;
  }
  const ownKeys = Reflect.ownKeys(value);
  const expectedKeyCount = value.length + 1;
  if (ownKeys.length !== expectedKeyCount) {
    return null;
  }
  const lengthProperty = readYamlStorageLegacyFenceOwnDataProperty(value, 'length');
  if (lengthProperty.found === false || lengthProperty.value !== value.length) {
    return null;
  }
  for (let index = 0; index < value.length; index += 1) {
    const property = readYamlStorageLegacyFenceOwnDataProperty(value, String(index));
    if (property.found === false) {
      return null;
    }
  }
  return value;
}

export function compareYamlStorageLegacyFenceParticipants(
  left: Readonly<{ readonly participantKind: 'tab' | 'worker'; readonly participantId: string }>,
  right: Readonly<{ readonly participantKind: 'tab' | 'worker'; readonly participantId: string }>
): number {
  if (left.participantKind !== right.participantKind) {
    return left.participantKind === 'tab' ? -1 : 1;
  }
  if (left.participantId < right.participantId) {
    return -1;
  }
  if (left.participantId > right.participantId) {
    return 1;
  }
  return 0;
}
