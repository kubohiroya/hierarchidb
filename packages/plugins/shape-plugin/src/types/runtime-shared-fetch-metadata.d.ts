declare module '@hierarchidb/runtime-shared-fetch-metadata' {
  export interface CountryMetadata {
    id?: string;
    countryCode?: string;
    iso3?: string;
    name?: string;
    countryName?: string;
    continent?: string;
    adminLevels?: number[];
    population?: number;
    area?: number;
    [key: string]: unknown;
  }
}
