export interface CORSOptions {
    allowedOrigins: string[];
    allowedMethods?: string[];
    allowedHeaders?: string[];
    allowCredentials?: boolean;
}
export declare function getCORSHeaders(requestOrigin: string | undefined, options: CORSOptions): Record<string, string>;
export declare function parseAllowedOrigins(originsString: string): string[];
//# sourceMappingURL=cors.d.ts.map