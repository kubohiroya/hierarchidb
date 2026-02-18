import { Dexie, type Table } from "dexie";
import { getDBName } from "@hierarchidb/util";
import { parseCsv } from "./csv.js";
import type {
  CountryRecord,
  EnsureIsoOptions,
  SubdivisionRecord,
  SubdivisionRow,
} from "./types.js";

class Iso3166Dexie extends Dexie {
  countries!: Table<CountryRecord, string>;
  subdivisions!: Table<SubdivisionRecord, string>;

  constructor(name = getDBName("iso3166-2-cache")) {
    super(name);
    this.version(1).stores({
      countries: "&alpha2, alpha3",
      subdivisions: "&code, alpha2, alpha3",
    });
  }
}

const hasIndexedDB = () => typeof indexedDB !== "undefined";
let dexieDb: Iso3166Dexie | null = null;
const memoryStore = {
  countries: new Map<string, CountryRecord>(),
  subdivisions: new Map<string, SubdivisionRecord>(),
};

const normalizeBasePath = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "/";
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const path = url.pathname || "/";
      return path.endsWith("/") ? path : `${path}/`;
    } catch {
      return "/";
    }
  }
  const withLeading = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeading.endsWith("/") ? withLeading : `${withLeading}/`;
};

const resolveBaseUrl = (): string => {
  const meta = (typeof import.meta !== "undefined"
    ? (import.meta as { env?: { BASE_URL?: string; VITE_BASE_URL?: string } })
    : null);
  const envBase = meta?.env?.VITE_BASE_URL || meta?.env?.BASE_URL;
  if (typeof envBase === "string" && envBase.length > 0) {
    return normalizeBasePath(envBase);
  }
  if (typeof window !== "undefined") {
    const hinted = (window as Window & { __HDB_APP_BASE__?: unknown }).__HDB_APP_BASE__;
    if (typeof hinted === "string" && hinted.length > 0) {
      return normalizeBasePath(hinted);
    }
  }
  if (typeof document !== "undefined") {
    try {
      const baseEl = document.querySelector("base");
      const href = baseEl?.getAttribute("href");
      if (typeof href === "string" && href.length > 0) {
        const url = new URL(href, window.location.origin);
        return normalizeBasePath(url.pathname);
      }
    } catch {
      // ignore
    }
  }
  return "/";
};

export const resolveIso3166CsvUrl = (csvFile = "iso3166-2-level1.csv"): string => {
  const baseUrl = resolveBaseUrl();
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${normalizedBase}${csvFile}`;
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
  const db = hasIndexedDB() ? (dexieDb ?? (dexieDb = new Iso3166Dexie())) : null;

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
