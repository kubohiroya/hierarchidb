import type { DatabasePrewarmTarget, NormalizedDatabasePrewarmEntry } from './types.ts';

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

export function sanitizeDependencies(pkgJson: any): string[] {
  if (!pkgJson || typeof pkgJson !== 'object') return [];
  const deps = pkgJson.dependencies ?? {};
  const peerDeps = pkgJson.peerDependencies ?? {};
  return filterValidDependencies([...Object.keys(deps), ...Object.keys(peerDeps)]);
}

export function sanitizeManifest(
  manifest: any,
  { packageDescription }: { packageDescription?: string } = {},
) {
  if (!manifest || typeof manifest !== 'object') return null;
  const result: Record<string, any> = {};

  const addString = (target: Record<string, any>, key: string, value: unknown) => {
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

  if (manifest.icon && typeof manifest.icon === 'object') {
    const icon: Record<string, any> = {};
    addString(icon, 'muiIconName', manifest.icon.muiIconName);
    addString(icon, 'mui', manifest.icon.mui);
    addString(icon, 'emoji', manifest.icon.emoji);
    addString(icon, 'color', manifest.icon.color);

    if (!icon.muiIconName && icon.mui) {
      icon.muiIconName = icon.mui;
    }

    const componentConfig = manifest.icon.component;
    if (componentConfig && typeof componentConfig === 'object') {
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
  } else if (manifest.category && typeof manifest.category === 'object') {
    const category: Record<string, any> = {};
    addString(category, 'menuGroup', manifest.category.menuGroup);
    if (typeof manifest.category.createOrder === 'number' && Number.isFinite(manifest.category.createOrder)) {
      category.createOrder = manifest.category.createOrder;
    }
    addString(category, 'treeId', manifest.category.treeId);
    if (Object.keys(category).length > 0) {
      result.category = category;
    }
  }

  if (manifest.schema && typeof manifest.schema === 'object') {
    const schema: Record<string, any> = {};
    addString(schema, 'inherits', manifest.schema.inherits);
    if (Array.isArray(manifest.schema.fields)) {
      schema.fields = manifest.schema.fields
        .filter((field: any) => field && typeof field === 'object')
        .map((field: any) => ({
          name: String(field.name ?? ''),
          type: String(field.type ?? ''),
          required: Boolean(field.required ?? false),
        }));
    }
    if (Object.keys(schema).length > 0) {
      result.schema = schema;
    }
  }

  if (manifest.worker && typeof manifest.worker === 'object') {
    const worker: Record<string, any> = {};
    if (Array.isArray(manifest.worker.preload)) {
      const preload = manifest.worker.preload
        .map((value: unknown) => (typeof value === 'string' && value.trim().length > 0 ? value.trim() : null))
        .filter((value: string | null): value is string => value !== null);
      if (preload.length > 0) {
        worker.preload = preload;
      }
    }
    if (Object.keys(worker).length > 0) {
      result.worker = worker;
    }
  }

  if (manifest.database && typeof manifest.database === 'object') {
    const database: Record<string, any> = {};
    addString(database, 'dbName', manifest.database.dbName);
    addString(database, 'tableName', manifest.database.tableName);
    if (typeof manifest.database.version === 'number' && Number.isFinite(manifest.database.version)) {
      database.version = manifest.database.version;
    }
    if (manifest.database.schema && typeof manifest.database.schema === 'object') {
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
