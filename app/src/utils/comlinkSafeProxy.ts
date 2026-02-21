const symbolGuardCache = new WeakMap<object, unknown>();
const TO_PRIMITIVE = Symbol.toPrimitive;
const INSPECT = Symbol.for('nodejs.util.inspect.custom');
const utilInspectSymbol = typeof INSPECT === 'symbol' ? INSPECT : undefined;

const isProxyTarget = (value: unknown): value is object =>
  typeof value === 'function' || (typeof value === 'object' && value !== null);

export function sanitizeRemoteForReact<T>(client: T): T {
  if (!isProxyTarget(client)) {
    return client;
  }

  const cached = symbolGuardCache.get(client);
  if (cached) {
    return cached as T;
  }

  const sanitizeNestedValue = (value: unknown): unknown => {
    if (isProxyTarget(value)) {
      return sanitizeRemoteForReact(value);
    }
    return value;
  };

  const safeClient = new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === TO_PRIMITIVE) {
        return () => '[Comlink Remote Proxy]';
      }
      if (prop === 'toString') {
        return () => '[object ComlinkRemote]';
      }
      if (prop === 'valueOf') {
        return () => '[object ComlinkRemote]';
      }
      if (utilInspectSymbol && prop === utilInspectSymbol) {
        return () => '[object ComlinkRemote]';
      }
      if (typeof prop === 'symbol') {
        return undefined;
      }
      return sanitizeNestedValue(Reflect.get(target, prop, receiver)) as unknown;
    },
    has(target, prop) {
      if (typeof prop === 'symbol') {
        return false;
      }
      return Reflect.has(target, prop);
    },
    ownKeys(target) {
      return Reflect.ownKeys(target).filter((prop) => typeof prop !== 'symbol');
    },
    getOwnPropertyDescriptor(target, prop) {
      if (typeof prop === 'symbol') {
        return undefined;
      }
      const descriptor = Reflect.getOwnPropertyDescriptor(target, prop);
      if (!descriptor) return undefined;
      if ('value' in descriptor && isProxyTarget(descriptor.value)) {
        return {
          ...descriptor,
          value: sanitizeNestedValue(descriptor.value),
        };
      }
      return descriptor;
    },
    set(target, prop, value, receiver) {
      if (typeof prop === 'symbol') {
        return true;
      }
      if (isProxyTarget(value)) {
        return Reflect.set(target, prop, sanitizeNestedValue(value), receiver);
      }
      return Reflect.set(target, prop, value, receiver);
    },
  });

  symbolGuardCache.set(client, safeClient);
  return safeClient as T;
}
