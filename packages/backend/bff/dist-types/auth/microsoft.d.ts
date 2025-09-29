export interface MicrosoftOAuth2Config {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
}
export interface MicrosoftUserInfo {
    id: string;
    displayName: string;
    mail: string;
    userPrincipalName: string;
}
export declare function initiateMicrosoftAuth(config: MicrosoftOAuth2Config): Promise<{
    authUrl: string;
    codeVerifier: string;
    state: string;
}>;
export declare function exchangeCodeForTokens(code: string, config: MicrosoftOAuth2Config, codeVerifier?: string): Promise<{
    access_token: string;
    refresh_token?: string;
}>;
export declare function getMicrosoftUserInfo(accessToken: string): Promise<MicrosoftUserInfo>;
//# sourceMappingURL=microsoft.d.ts.map