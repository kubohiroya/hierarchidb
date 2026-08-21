declare const __HDB_DATABASE_PREFIX__: unknown;

const DATABASE_NAME_COMPONENT_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

function requireDatabaseNameComponent(
  value: unknown,
  requiredCode: string,
  invalidCode: string
): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(requiredCode);
  }
  if (!DATABASE_NAME_COMPONENT_PATTERN.test(value)) {
    throw new Error(invalidCode);
  }
  return value;
}

/** Reads the single database prefix injected by the application build. */
export function getBuildDatabasePrefix(): string {
  if (typeof __HDB_DATABASE_PREFIX__ === 'undefined') {
    throw new Error('database-prefix-required');
  }
  return requireDatabaseNameComponent(
    __HDB_DATABASE_PREFIX__,
    'database-prefix-required',
    'database-prefix-invalid'
  );
}

/** Creates an exact database name from explicit, validated components. */
export function getDBName(prefix: string, suffix: string): string {
  const exactPrefix = requireDatabaseNameComponent(
    prefix,
    'database-prefix-required',
    'database-prefix-invalid'
  );
  const exactSuffix = requireDatabaseNameComponent(
    suffix,
    'database-suffix-required',
    'database-suffix-invalid'
  );
  return `${exactPrefix}-${exactSuffix}`;
}
