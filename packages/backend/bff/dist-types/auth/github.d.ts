export interface GitHubOAuth2Config {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
}
export interface GitHubUserInfo {
    id: number;
    login: string;
    email: string | null;
    name: string | null;
    avatar_url: string;
}
export declare function initiateGitHubAuth(config: GitHubOAuth2Config): Promise<{
    authUrl: string;
    codeVerifier: string;
    state: string;
}>;
export declare function exchangeCodeForTokens(code: string, config: GitHubOAuth2Config): Promise<{
    access_token: string;
}>;
export declare function getGitHubUserInfo(accessToken: string): Promise<GitHubUserInfo>;
//# sourceMappingURL=github.d.ts.map