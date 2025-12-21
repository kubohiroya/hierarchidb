import { Dexie, type Table } from "dexie";
import { parseCsv } from "./csv.js";
import {
  type CountryRecord,
  type EnsureIsoOptions,
  type SubdivisionRecord,
  type SubdivisionRow,
} from "./types.js";

class Iso3166Dexie extends Dexie {
  countries!: Table<CountryRecord, string>;
  subdivisions!: Table<SubdivisionRecord, string>;

  constructor(name = "iso3166-2-cache") {
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

export function rowsToRecords(rows: SubdivisionRow): SubdivisionRecord;
export function rowsToRecords(rows: SubdivisionRow[]): { countries: CountryRecord[]; subdivisions: SubdivisionRecord[] };
export function rowsToRecords(rows: SubdivisionRow | SubdivisionRow[]) {
  if (!Array.isArray(rows)) {
    return {
      code: rows.subdivisionCode,
      alpha2: rows.alpha2,
      alpha3: rows.alpha3,
      countryEn: rows.countryEn,
      location: rows.location,
      subdivisionEn: rows.subdivisionEn,
      subdivisionLocal: rows.subdivisionLocal,
    } as SubdivisionRecord;
  }
  const countriesMap = new Map<string, CountryRecord>();
  const subdivisions: SubdivisionRecord[] = [];
  rows.forEach((r) => {
    subdivisions.push(rowsToRecords(r));
    if (!countriesMap.has(r.alpha2)) {
      countriesMap.set(r.alpha2, {
        alpha2: r.alpha2,
        alpha3: r.alpha3,
        countryEn: r.countryEn,
        location: r.location,
      });
    }
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
  const useScraper = options.useScraper ?? (typeof window === "undefined");

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

  if (useScraper) {
    const { generateIso3166Data } = await import("./scraper.js");
    const { rows } = await generateIso3166Data();
    const records = rowsToRecords(rows);
    const source = await populateStore(records, db);
    return { source: source === "dexie" ? "scrape-dexie" : "scrape-memory" };
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
