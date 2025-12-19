export type CountryRow = {
  countryEn: string;
  alpha3: string;
  alpha2: string;
  location: string; // "場所" column text (region)
  iso3166_2_url?: string; // link to ISO_3166-2:XX (ja or en)
};

export type SubdivisionRow = {
  countryEn: string;
  alpha3: string;
  alpha2: string;
  location: string;
  subdivisionEn: string;
  subdivisionLocal: string;
  subdivisionCode: string; // e.g., "JP-01"
};

export type GenerateResult = {
  rows: SubdivisionRow[];
  countries: CountryRow[];
  failures: Array<{ alpha2: string; reason: string }>;
};

export interface GenerateOptions {
  outputDir?: string;
  outputFile?: string;
  failureFile?: string;
  logger?: (message: string) => void;
}

export interface Iso3166PluginOptions extends GenerateOptions {
  enabled?: boolean;
  /**
   * If provided, try to hydrate Dexie in-browser using this CSV URL at runtime.
   * (Useful to point to the built asset path)
   */
  csvUrl?: string;
}

export interface EnsureIsoOptions {
  csvPath?: string;
  csvUrl?: string;
  csvText?: string;
  useScraper?: boolean;
  outputDir?: string;
  outputFile?: string;
  failureFile?: string;
}

export type CountryRecord = {
  alpha2: string;
  alpha3: string;
  countryEn: string;
  location: string;
};

export type SubdivisionRecord = {
  code: string;
  alpha2: string;
  alpha3: string;
  countryEn: string;
  location: string;
  subdivisionEn: string;
  subdivisionLocal: string;
};
