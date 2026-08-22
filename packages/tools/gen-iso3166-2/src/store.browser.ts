import { Dexie, type Table } from "dexie";
import { getBuildDatabasePrefix, getDBName } from "@hierarchidb/util";
import { DEFAULT_COUNTRY_NAMES_I18N_OUTPUT, parseCsv } from "./csv.js";
import type {
  CountryRecord,
  EnsureIsoOptions,
  SubdivisionRecord,
  SubdivisionRow,
} from "./types.js";

class Iso3166Dexie extends Dexie {
  countries!: Table<CountryRecord, string>;
  subdivisions!: Table<SubdivisionRecord, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      countries: "&alpha2, alpha3",
      subdivisions: "&code, alpha2, alpha3",
    });
  }
}

const hasIndexedDB = () => typeof indexedDB !== "undefined";
let dexieDb: Iso3166Dexie | null = null;
let countryNamesI18nCache: Record<string, Record<string, string>> | null = null;
const memoryStore = {
  countries: new Map<string, CountryRecord>(),
  subdivisions: new Map<string, SubdivisionRecord>(),
};

type BrowserGlobalWithAppBase = typeof globalThis & {
  __HDB_APP_BASE__?: unknown;
};

const normalizeBasePath = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Vite BASE_URL is required to resolve ISO-3166 CSV assets.");
  }
  if (/^https?:\/\//i.test(trimmed)) {
    const url = new URL(trimmed);
    const path = url.pathname || "/";
    return path.endsWith("/") ? path : `${path}/`;
  }
  const withLeading = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeading.endsWith("/") ? withLeading : `${withLeading}/`;
};

const getViteBaseUrl = (): string | null => {
  const baseUrl = import.meta.env.BASE_URL;
  if (typeof baseUrl !== "string" || baseUrl.length === 0 || baseUrl === "undefined") {
    return null;
  }
  return baseUrl;
};

const getHintedBaseUrl = (): string | null => {
  const hinted = (globalThis as BrowserGlobalWithAppBase).__HDB_APP_BASE__;
  return typeof hinted === "string" && hinted.length > 0 ? hinted : null;
};

const getDocumentBaseUrl = (): string | null => {
  if (typeof document === "undefined") {
    return null;
  }
  const baseUri = document.baseURI;
  if (typeof baseUri !== "string" || baseUri.length === 0) {
    return null;
  }
  return new URL(".", baseUri).pathname;
};

const resolveBaseUrl = (): string => {
  const baseUrl = getViteBaseUrl() ?? getHintedBaseUrl() ?? getDocumentBaseUrl();
  if (baseUrl === null) {
    throw new Error("Vite BASE_URL is required to resolve ISO-3166 CSV assets.");
  }
  return normalizeBasePath(baseUrl);
};

export const resolveIso3166CsvUrl = (csvFile = "iso3166-2-level1.csv"): string => {
  const baseUrl = resolveBaseUrl();
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${normalizedBase}${csvFile}`;
};

export const resolveIso3166CountryNamesI18nUrl = (
  file = DEFAULT_COUNTRY_NAMES_I18N_OUTPUT,
): string => {
  const baseUrl = resolveBaseUrl();
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${normalizedBase}${file}`;
};

const rowToRecord = (row: SubdivisionRow): SubdivisionRecord | null => {
  if (!row.subdivisionCode) return null;
  return {
    code: row.subdivisionCode,
    alpha2: row.alpha2,
    alpha3: row.alpha3,
    countryEn: row.countryEn,
    location: row.location,
    subdivisionEn: row.subdivisionEn,
    subdivisionLocal: row.subdivisionLocal,
  };
};

const addCountryRecord = (countriesMap: Map<string, CountryRecord>, row: SubdivisionRow): void => {
  const alpha2 = row.alpha2?.trim().toUpperCase();
  if (!alpha2 || countriesMap.has(alpha2)) return;
  countriesMap.set(alpha2, {
    alpha2,
    alpha3: row.alpha3?.trim().toUpperCase(),
    countryEn: row.countryEn,
    location: row.location,
  });
};

export function rowsToRecords(rows: SubdivisionRow[]): { countries: CountryRecord[]; subdivisions: SubdivisionRecord[] } {
  const countriesMap = new Map<string, CountryRecord>();
  const subdivisions: SubdivisionRecord[] = [];
  rows.forEach((r) => {
    const subdivisionRecord = rowToRecord(r);
    if (subdivisionRecord) {
      subdivisions.push(subdivisionRecord);
    }
    addCountryRecord(countriesMap, r);
  });
  return { countries: Array.from(countriesMap.values()), subdivisions };
}

async function populateStore(
  records: { countries: CountryRecord[]; subdivisions: SubdivisionRecord[] },
  db: Iso3166Dexie | null,
) {
  if (db) {
    await db.transaction("rw", db.countries, db.subdivisions, async () => {
      await db.countries.bulkPut(records.countries);
      await db.subdivisions.bulkPut(records.subdivisions);
    });
    return "dexie" as const;
  }
  records.countries.forEach((c) => memoryStore.countries.set(c.alpha2, c));
  records.subdivisions.forEach((s) => memoryStore.subdivisions.set(s.code, s));
  return "memory" as const;
}

async function loadCsvToStore(csvText: string, db: Iso3166Dexie | null) {
  const parsed = parseCsv(csvText);
  const records = rowsToRecords(parsed);
  return populateStore(records, db);
}

export async function ensureIso3166Data(options: EnsureIsoOptions = {}) {
  const db = hasIndexedDB()
    ? (dexieDb ?? (dexieDb = new Iso3166Dexie(
      getDBName(getBuildDatabasePrefix(), "iso3166-2-cache"),
    )))
    : null;

  if (db) {
    const count = await db.subdivisions.count();
    if (count > 0) return { source: "dexie-cached" as const };
  }

  if (options.csvText) {
    const source = await loadCsvToStore(options.csvText, db);
    return { source };
  }

  if (options.csvUrl && typeof fetch !== "undefined") {
    try {
      const res = await fetch(options.csvUrl);
      if (res.ok) {
        const csv = await res.text();
        const source = await loadCsvToStore(csv, db);
        return { source, csvUrl: options.csvUrl };
      }
    } catch {
      // continue
    }
  }

  return { source: "none" as const };
}

export async function ensureIso3166CountryNamesI18n(options: EnsureIsoOptions = {}) {
  if (countryNamesI18nCache) return { source: "cached" as const };
  if (options.countryNamesI18nText) {
    const parsed = JSON.parse(options.countryNamesI18nText) as Record<string, Record<string, string>>;
    countryNamesI18nCache = parsed;
    return { source: "inline" as const };
  }
  const jsonUrl = options.countryNamesI18nUrl ?? resolveIso3166CountryNamesI18nUrl();
  if (typeof fetch !== "undefined") {
    try {
      const res = await fetch(jsonUrl);
      if (res.ok) {
        const text = await res.text();
        const parsed = JSON.parse(text) as Record<string, Record<string, string>>;
        countryNamesI18nCache = parsed;
        return { source: "network" as const, jsonUrl };
      }
    } catch {
      // continue
    }
  }
  return { source: "none" as const };
}

const normalizeLocaleKey = (locale: string | undefined): string => {
  const normalized = (locale ?? "en").trim().toLowerCase();
  const [base] = normalized.split("-");
  return base && base.length > 0 ? base : "en";
};

const resolveCountryCodeKey = (code: string): string | null => {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  return normalized;
};

export function getLocalizedCountryName(code: string, locale: string): string | null {
  if (!countryNamesI18nCache) return null;
  const codeKey = resolveCountryCodeKey(code);
  if (!codeKey) return null;
  const localeKey = normalizeLocaleKey(locale);
  const primary = countryNamesI18nCache[localeKey];
  if (primary && typeof primary[codeKey] === "string" && primary[codeKey].trim().length > 0) {
    return primary[codeKey].trim();
  }
  const fallbackEn = countryNamesI18nCache.en;
  if (fallbackEn && typeof fallbackEn[codeKey] === "string" && fallbackEn[codeKey].trim().length > 0) {
    return fallbackEn[codeKey].trim();
  }
  const fallbackJa = countryNamesI18nCache.ja;
  if (fallbackJa && typeof fallbackJa[codeKey] === "string" && fallbackJa[codeKey].trim().length > 0) {
    return fallbackJa[codeKey].trim();
  }
  return null;
}

export async function getCountry(alpha: string) {
  const key = alpha.toUpperCase();
  const db = dexieDb && hasIndexedDB() ? dexieDb : null;
  if (db) {
    const country =
      (await db.countries.get(key)) ||
      (await db.countries.where("alpha3").equals(key).first()) ||
      null;
    const subdivisions = country
      ? await db.subdivisions.where("alpha2").equals(country.alpha2).toArray()
      : [];
    return { country, subdivisions };
  }

  let country = memoryStore.countries.get(key) || null;
  if (!country) {
    country =
      Array.from(memoryStore.countries.values()).find((c) => c.alpha3 === key) ||
      null;
  }
  const subdivisions = country
    ? Array.from(memoryStore.subdivisions.values()).filter((s) => s.alpha2 === country.alpha2)
    : [];
  return { country, subdivisions };
}

export async function getSubdivision(code: string) {
  const upper = code.toUpperCase();
  const db = dexieDb && hasIndexedDB() ? dexieDb : null;
  if (db) {
    const subdivision = await db.subdivisions.get(upper);
    return subdivision ?? null;
  }
  return memoryStore.subdivisions.get(upper) ?? null;
}

export async function getAllCountries(): Promise<CountryRecord[]> {
  const db = dexieDb && hasIndexedDB() ? dexieDb : null;
  if (db) {
    return db.countries.toArray();
  }
  return Array.from(memoryStore.countries.values());
}
