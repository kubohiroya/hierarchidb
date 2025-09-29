export interface GoogleOAuth2Config {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
}
export interface GoogleUserInfo {
    id: string;
    email: string;
    name: string;
    picture: string;
}
export declare function initiateGoogleAuth(config: GoogleOAuth2Config): Promise<{
    authUrl: string;
    codeVerifier: string;
    state: string;
}>;
export type ExchangeCodeForTokensReturn = {
    access_token: string;
    id_token?: string;
    refresh_token?: string;
};
export declare function exchangeCodeForTokens(code: string, config: GoogleOAuth2Config, codeVerifier?: string): Promise<ExchangeCodeForTokensReturn>;
export declare function getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo>;
//# sourceMappingURL=google.d.ts.map