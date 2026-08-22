import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@hierarchidb/util", () => ({
  getBuildDatabasePrefix: () => "test",
  getDBName: (prefix: string, kind: string) => `${prefix}-${kind}`,
}));

const loadStoreBrowser = () => import("../store.browser.js");

const originalBaseUrl = import.meta.env.BASE_URL;

const setViteBaseUrl = (value: string | undefined): void => {
  Object.defineProperty(import.meta.env, "BASE_URL", {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
};

const clearDocumentBaseElements = (): void => {
  document.querySelectorAll("base").forEach((element) => element.remove());
};

afterEach(() => {
  setViteBaseUrl(originalBaseUrl);
  delete (globalThis as typeof globalThis & { __HDB_APP_BASE__?: unknown }).__HDB_APP_BASE__;
  clearDocumentBaseElements();
});

describe("resolveIso3166CsvUrl", () => {
  it("uses direct import.meta.env.BASE_URL so Vite can replace the app base in worker bundles", async () => {
    setViteBaseUrl("/hierarchidb/");
    (globalThis as typeof globalThis & { __HDB_APP_BASE__?: string }).__HDB_APP_BASE__ = "/wrong/";

    const { resolveIso3166CsvUrl } = await loadStoreBrowser();

    expect(resolveIso3166CsvUrl()).toBe("/hierarchidb/iso3166-2-level1.csv");
  });

  it("keeps browser base hints when Vite BASE_URL is unavailable", async () => {
    setViteBaseUrl(undefined);
    (globalThis as typeof globalThis & { __HDB_APP_BASE__?: string }).__HDB_APP_BASE__ = "hierarchidb";

    const { resolveIso3166CsvUrl } = await loadStoreBrowser();

    expect(resolveIso3166CsvUrl()).toBe("/hierarchidb/iso3166-2-level1.csv");
  });

  it("resolves from document base outside worker bundles when no explicit hint exists", async () => {
    setViteBaseUrl(undefined);
    const base = document.createElement("base");
    base.href = "https://example.test/hierarchidb/";
    document.head.append(base);

    const { resolveIso3166CountryNamesI18nUrl } = await loadStoreBrowser();

    expect(resolveIso3166CountryNamesI18nUrl()).toBe(
      "/hierarchidb/iso3166-country-names.i18n.json",
    );
  });
});

describe("rowsToRecords", () => {
  it("keeps JP as the canonical country key and JPN as the external payload code", async () => {
    const { rowsToRecords } = await loadStoreBrowser();
    const { countries, subdivisions } = rowsToRecords([
      {
        alpha2: "JP",
        alpha3: "JPN",
        countryEn: "Japan",
        location: "Asia",
        subdivisionCode: "JP-13",
        subdivisionEn: "Tokyo",
        subdivisionLocal: "Tokyo",
      },
    ]);

    expect(countries).toEqual([
      {
        alpha2: "JP",
        alpha3: "JPN",
        countryEn: "Japan",
        location: "Asia",
      },
    ]);
    expect(subdivisions[0]).toMatchObject({ alpha2: "JP", alpha3: "JPN", code: "JP-13" });
  });
});
