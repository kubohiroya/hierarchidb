export interface YamlIdeGsmAppConfig {
  readonly yamlIdeGsmStep4Enabled: boolean;
  readonly mountedIdeGsmCommandUiEnabled: boolean;
}

type EnvLike = Readonly<Record<string, string | boolean | undefined>>;

function readStartupFlag(env: EnvLike, key: string): boolean {
  const value = env[key];
  if (value === undefined || value === false || value === '0' || value === '') return false;
  if (value === true || value === '1') return true;
  throw new Error(`${key} must be unset, 0, or 1`);
}

export function resolveYamlIdeGsmAppConfig(env: EnvLike): YamlIdeGsmAppConfig {
  return Object.freeze({
    yamlIdeGsmStep4Enabled: readStartupFlag(env, 'VITE_YAML_IDE_GSM_STEP4_ENABLED'),
    mountedIdeGsmCommandUiEnabled: readStartupFlag(env, 'VITE_MOUNTED_IDE_GSM_COMMAND_UI_ENABLED'),
  });
}

export const YAML_IDE_GSM_APP_CONFIG: YamlIdeGsmAppConfig = resolveYamlIdeGsmAppConfig(
  import.meta.env as EnvLike
);
