import { IdeGsmClient } from '@hierarchidb/ide-gsm-client';
import { YAML_IDE_GSM_APP_CONFIG } from './yamlIdeGsmConfig.js';
import type { YamlIdeGsmCredentials } from './yamlIdeGsmCredentialProvider.js';
import { createYamlIdeGsmExecutor } from './yamlIdeGsmExecutor.js';
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
