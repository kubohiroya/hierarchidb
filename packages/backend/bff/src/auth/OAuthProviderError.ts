export type OAuthProviderOperation = 'token_exchange' | 'userinfo';

type OAuthProviderErrorParams = {
  provider: 'google' | 'github' | 'microsoft';
  operation: OAuthProviderOperation;
  status: number;
  providerErrorCode?: string;
};

export class OAuthProviderError extends Error {
  readonly provider: OAuthProviderErrorParams['provider'];
  readonly operation: OAuthProviderOperation;
  readonly status: number;
  readonly providerErrorCode: string | undefined;

  constructor(params: OAuthProviderErrorParams) {
    super(`${params.provider} ${params.operation} request failed`);
    this.name = 'OAuthProviderError';
    this.provider = params.provider;
    this.operation = params.operation;
    this.status = params.status;
    this.providerErrorCode = params.providerErrorCode;
  }
}
