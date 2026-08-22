import { IdeGsmClient } from '@hierarchidb/ide-gsm-client';
import { createYamlIdeGsmExecutor } from './createYamlIdeGsmExecutor.js';
import { YAML_IDE_GSM_APP_CONFIG } from './YamlIdeGsmAppConfig.js';
import type { YamlIdeGsmCredentials } from './yamlIdeGsmCredentialProvider.js';
import type {
  YamlIdeGsmExecutor,
  YamlIdeGsmExecutorDependencies,
} from './yamlIdeGsmExecutorTypes.js';

export function createDefaultYamlIdeGsmClient(credentials: YamlIdeGsmCredentials): IdeGsmClient {
  return new IdeGsmClient(credentials.endpointUrl, credentials.authToken);
}

export function createDefaultYamlIdeGsmExecutor(
  dependencies: Omit<YamlIdeGsmExecutorDependencies, 'config' | 'createClient'>
): YamlIdeGsmExecutor {
  return createYamlIdeGsmExecutor({
    ...dependencies,
    config: YAML_IDE_GSM_APP_CONFIG,
    createClient: createDefaultYamlIdeGsmClient,
  });
}
