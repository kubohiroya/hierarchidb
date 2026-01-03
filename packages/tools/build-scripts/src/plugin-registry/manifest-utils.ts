import type { DatabasePrewarmTarget, NormalizedDatabasePrewarmEntry } from './types.js';

export function deriveNodeType(pkgName: string): string | undefined {
  const match = pkgName.match(/@hierarchidb\/([a-z0-9-]+)-plugin$/);
  return match?.[1];
}

export function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function toPascalCase(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^[A-Z][A-Za-z0-9]*$/.test(trimmed)) return trimmed;
  const parts = trimmed
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  if (parts.length === 0) return undefined;
  return parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join('');
}

export function normalizeMuiIconName(raw?: string): string | undefined {
  if (!raw) return undefined;
  const lut: Record<string, string> = {
    locationpin: 'LocationOn',
    location: 'LocationOn',
    mapmarker: 'Place',
    basemap: 'Public',
    project: 'AccountTree',
    spreadsheet: 'Assessment',
    resolver: 'Extension',
    styler: 'Palette',
    timeline: 'AccessTime',
  };
  const key = raw.replace(/[^a-z0-9]/gi, '').toLowerCase();
  const mapped = lut[key] || raw;
  const pascal = toPascalCase(mapped);
  if (!pascal) return undefined;
  if (pascal.endsWith('Icon')) {
    const trimmed = pascal.slice(0, -4);
    return trimmed.length > 0 ? trimmed : pascal;
  }
  return pascal;
}

export function normalizeDatabasePrewarmValue(raw: unknown): NormalizedDatabasePrewarmEntry[] {
  const entries: NormalizedDatabasePrewarmEntry[] = [];
  const visit = (value: unknown): void => {
    if (value == null) return;
    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item);
      }
      return;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        entries.push({ export: trimmed });
      }
      return;
    }
    if (typeof value === 'object') {
      const record = value as Record<string, unknown>;
      const exportRaw = typeof record.export === 'string'
        ? record.export
        : typeof record.exportName === 'string'
          ? record.exportName
          : typeof record.name === 'string'
            ? record.name
            : null;
      const trimmedExport = exportRaw?.trim();
      if (!trimmedExport) return;
      const specifierRaw = typeof record.specifier === 'string'
        ? record.specifier
        : typeof record.module === 'string'
          ? record.module
          : undefined;
      const trimmedSpecifier = specifierRaw?.trim();
      const entry: NormalizedDatabasePrewarmEntry = { export: trimmedExport };
      if (trimmedSpecifier && trimmedSpecifier.length > 0) {
        entry.specifier = trimmedSpecifier;
      }
      entries.push(entry);
    }
  };
  visit(raw);
  return entries;
}

export function buildDatabasePrewarmTargets(
  raw: unknown,
  fallbackSpecifier: string,
): DatabasePrewarmTarget[] {
  const result: DatabasePrewarmTarget[] = [];
  if (!raw) return result;
  const items = Array.isArray(raw) ? raw : [raw];
  for (const item of items) {
    if (!item) continue;
    if (typeof item === 'string') {
      const exportName = item.trim();
      if (!exportName) continue;
      result.push({ exportName, specifier: fallbackSpecifier });
      continue;
    }
    if (typeof item === 'object') {
      const record = item as Record<string, unknown>;
      const exportRaw = typeof record.export === 'string'
        ? record.export
        : typeof record.exportName === 'string'
          ? record.exportName
          : typeof record.name === 'string'
            ? record.name
            : null;
      const exportName = exportRaw?.trim();
      if (!exportName) continue;
      const specifierRaw = typeof record.specifier === 'string'
        ? record.specifier
        : typeof record.module === 'string'
          ? record.module
          : null;
      const specifier = specifierRaw?.trim() || fallbackSpecifier;
      if (!specifier) continue;
      result.push({ exportName, specifier });
    }
  }
  return result;
}

export function filterValidDependencies(values: Array<string | null>): string[] {
  return values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function sanitizeDependencies(pkgJson: unknown): string[] {
  if (!isRecord(pkgJson)) return [];
  const deps = isRecord(pkgJson.dependencies) ? pkgJson.dependencies : {};
  const peerDeps = isRecord(pkgJson.peerDependencies) ? pkgJson.peerDependencies : {};
  return filterValidDependencies([...Object.keys(deps), ...Object.keys(peerDeps)]);
}

export function sanitizeManifest(
  manifest: unknown,
  { packageDescription }: { packageDescription?: string } = {},
): Record<string, unknown> | null {
  if (!isRecord(manifest)) return null;
  const result: Record<string, unknown> = {};

  const addString = (target: Record<string, unknown>, key: string, value: unknown) => {
    if (typeof value === 'string' && value.trim().length > 0) {
      target[key] = value.trim();
    }
  };

  addString(result, 'id', manifest.id);
  addString(result, 'name', manifest.name);
  addString(result, 'displayName', manifest.displayName);
  addString(result, 'nodeType', manifest.nodeType);
  addString(result, 'version', manifest.version);
  addString(result, 'description', manifest.description);
  addString(result, 'extends', manifest.extends);

  if (!result.description && typeof packageDescription === 'string' && packageDescription.trim().length > 0) {
    result.description = packageDescription.trim();
  }

  if (typeof manifest.priority === 'number' && Number.isFinite(manifest.priority)) {
    result.priority = manifest.priority;
  }

  if (Array.isArray(manifest.dependencies)) {
    result.dependencies = manifest.dependencies.map(String);
  }

  if (isRecord(manifest.icon)) {
    const icon: Record<string, unknown> = {};
    addString(icon, 'muiIconName', (manifest.icon as Record<string, unknown>).muiIconName);
    addString(icon, 'mui', (manifest.icon as Record<string, unknown>).mui);
    addString(icon, 'emoji', (manifest.icon as Record<string, unknown>).emoji);
    addString(icon, 'color', (manifest.icon as Record<string, unknown>).color);

    if (!icon.muiIconName && typeof icon.mui === 'string') {
      icon.muiIconName = icon.mui;
    }

    const componentConfig = (manifest.icon as Record<string, unknown>).component;
    if (isRecord(componentConfig)) {
      const specifier = typeof componentConfig.specifier === 'string'
        ? componentConfig.specifier.trim()
        : undefined;
      const exportName = typeof componentConfig.exportName === 'string'
        ? componentConfig.exportName.trim()
        : typeof componentConfig.export === 'string'
          ? componentConfig.export.trim()
          : undefined;
      if (specifier) {
        const component: Record<string, string> = { specifier };
        if (exportName) {
          component.exportName = exportName;
        }
        icon.component = component;
      }
    }

    if (Object.keys(icon).length > 0) {
      result.icon = icon;
    }
  }

  if (typeof manifest.category === 'string') {
    result.category = manifest.category;
  } else if (isRecord(manifest.category)) {
    const category: Record<string, unknown> = {};
    addString(category, 'menuGroup', manifest.category.menuGroup);
    if (typeof manifest.category.createOrder === 'number' && Number.isFinite(manifest.category.createOrder)) {
      category.createOrder = manifest.category.createOrder;
    }
    addString(category, 'treeId', manifest.category.treeId);
    if (Object.keys(category).length > 0) {
      result.category = category;
    }
  }

  if (isRecord(manifest.schema)) {
    const schema: Record<string, unknown> = {};
    addString(schema, 'inherits', manifest.schema.inherits);
    if (Array.isArray(manifest.schema.fields)) {
      schema.fields = manifest.schema.fields
        .filter((field) => isRecord(field))
        .map((field) => ({
          name: String(field.name ?? ''),
          type: String(field.type ?? ''),
          required: Boolean(field.required ?? false),
        }));
    }
    if (Object.keys(schema).length > 0) {
      result.schema = schema;
    }
  }

  if (isRecord(manifest.worker)) {
    const worker: Record<string, unknown> = {};
    if (Array.isArray(manifest.worker.preload)) {
      const preload = manifest.worker.preload
        .map((value: unknown) => (typeof value === 'string' && value.trim().length > 0 ? value.trim() : null))
        .filter((value): value is string => value !== null);
      if (preload.length > 0) {
        worker.preload = preload;
      }
    }
    if (Object.keys(worker).length > 0) {
      result.worker = worker;
    }
  }

  if (isRecord(manifest.database)) {
    const database: Record<string, unknown> = {};
    addString(database, 'dbName', manifest.database.dbName);
    addString(database, 'tableName', manifest.database.tableName);
    if (typeof manifest.database.version === 'number' && Number.isFinite(manifest.database.version)) {
      database.version = manifest.database.version;
    }
    if (isRecord(manifest.database.schema)) {
      database.schema = manifest.database.schema;
    }
    const prewarmEntries = normalizeDatabasePrewarmValue(manifest.database.prewarm);
    if (prewarmEntries.length > 0) {
      database.prewarm = prewarmEntries.map((entry) => {
        const normalized: Record<string, string> = { export: entry.export };
        if (entry.specifier) {
          normalized.specifier = entry.specifier;
        }
        return normalized;
      });
    }
    if (Object.keys(database).length > 0) {
      result.database = database;
    }
  }

  return result;
}
