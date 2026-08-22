export interface YamlIdeGsmCredentials {
  readonly endpointUrl: string;
  readonly authToken: string;
}

export interface YamlIdeGsmCredentialProvider {
  getIdeGsmCredentials(): Promise<YamlIdeGsmCredentials>;
  getGitHubToken(): Promise<string>;
}

export interface RuntimeYamlIdeGsmCredentialSource {
  readonly getEndpointUrl: () => string | Promise<string>;
  readonly getAuthToken: () => string | Promise<string>;
  readonly getGitHubToken: () => string | Promise<string>;
}

function assertNonEmptyCredential(value: string, label: string): string {
  if (value.trim().length === 0) {
    throw new Error(`${label} is not configured`);
  }
  return value;
}

export function createRuntimeYamlIdeGsmCredentialProvider(
  source: RuntimeYamlIdeGsmCredentialSource
): YamlIdeGsmCredentialProvider {
  return Object.freeze({
    async getIdeGsmCredentials(): Promise<YamlIdeGsmCredentials> {
      const endpointUrl = assertNonEmptyCredential(await source.getEndpointUrl(), 'endpointUrl');
      const authToken = assertNonEmptyCredential(await source.getAuthToken(), 'authToken');
      return Object.freeze({ endpointUrl, authToken });
    },
    async getGitHubToken(): Promise<string> {
      return assertNonEmptyCredential(await source.getGitHubToken(), 'githubToken');
    },
  });
}
