import { loadWorkerAPIClientModule } from '../worker-runtime/workerApiClientLoader.js';
import { createDefaultYamlIdeGsmExecutor } from './createDefaultYamlIdeGsmClient.js';
import { YAML_IDE_GSM_APP_CONFIG } from './YamlIdeGsmAppConfig.js';
import { createRuntimeYamlIdeGsmCredentialProvider } from './yamlIdeGsmCredentialProvider.js';

type YamlIdeGsmStep4Global = typeof globalThis & {
  __HDB_YAML_IDE_GSM_STEP4__?: {
    readonly enabled: boolean;
    readonly executor?: unknown;
    readonly defaultProjectRelativePath?: string;
  };
};

function missingCredential(): string {
  throw new Error('yaml-ide-gsm-credential-source-unavailable');
}

export function configureYamlIdeGsmStep4Runtime(): void {
  if (!YAML_IDE_GSM_APP_CONFIG.yamlIdeGsmStep4Enabled) {
    (globalThis as YamlIdeGsmStep4Global).__HDB_YAML_IDE_GSM_STEP4__ = Object.freeze({
      enabled: false,
    });
    return;
  }

  const executor = createDefaultYamlIdeGsmExecutor({
    credentialProvider: createRuntimeYamlIdeGsmCredentialProvider({
      getEndpointUrl: missingCredential,
      getAuthToken: missingCredential,
      getGitHubToken: missingCredential,
    }),
    getYamlCanonicalZipAPI: async () => {
      const { WorkerAPIClient } = await loadWorkerAPIClientModule();
      const client = await WorkerAPIClient.getOrInit();
      return client.getYamlCanonicalZipAPI();
    },
  });

  (globalThis as YamlIdeGsmStep4Global).__HDB_YAML_IDE_GSM_STEP4__ = Object.freeze({
    enabled: true,
    executor,
  });
}
