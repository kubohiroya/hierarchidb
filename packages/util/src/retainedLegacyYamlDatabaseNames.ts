/**
 * Exact retained legacy YamlDB names accepted for the #1341 retention window.
 *
 * These names are evidence-derived retention targets, not suffix or prefix rules.
 * Do not infer additional protected names from `*-yaml`.
 */
export const retainedLegacyYamlDatabaseNames = ['hierarchidb-yaml'] as const;

const retainedLegacyYamlDatabaseNameSet = new Set<string>(retainedLegacyYamlDatabaseNames);

export const isRetainedLegacyYamlDatabaseName = (name: string): boolean =>
  retainedLegacyYamlDatabaseNameSet.has(name);
