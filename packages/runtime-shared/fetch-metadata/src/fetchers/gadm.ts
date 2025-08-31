import type { RegionMetadata } from "../utils/types";
import { saveMetadata } from "../utils/utils";

interface GADMCountryInfo {
  iso3: string;
  iso2: string;
  name: string;
  levels: number[];
}

/**
 * Fetch metadata from GADM (Global Administrative Areas)
 * GADM provides high-resolution administrative boundaries
 */
export async function fetchGADM(
  outputDirName: string,
  outputFileName: string,
): Promise<void> {
  console.log("📍 Fetching GADM metadata...");

  const baseUrl = "https://gadm.org";
  const metadata: RegionMetadata[] = [];

  try {
    // Fetch the download country page
    console.log("Fetching GADM country list...");
    const response = await fetch(`${baseUrl}/download_country.html`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();

    // Parse countries from HTML
    const countries = parseGADMHtml(html);
    console.log(`Found ${countries.length} countries`);

    // Map ISO3 to ISO2 for all countries
    countries.forEach((country) => {
      country.iso2 = mapISO3toISO2(country.iso3);
    });

    // Convert to RegionMetadata format
    for (const country of countries) {
      if (validateGADMCountry(country)) {
        const regionData: RegionMetadata = {
          id: country.iso3,
          name: country.name,
          countryName: country.name,
          countryCode: country.iso2,
          iso2: country.iso2,
          iso3: country.iso3,
          continent: "", // GADM doesn't provide continent info
          region: "",
          subregion: "",
          adminLevels: country.levels,
          numAdminLevels: country.levels.length,
          bbox: [-180, -90, 180, 90], // Would need additional API calls for actual bbox
        };

        metadata.push(regionData);
      }
    }

    console.log(`Valid countries: ${metadata.length}`);
    await saveMetadata(metadata, outputDirName, outputFileName);
  } catch (error) {
    console.error("Error fetching GADM data:", error);
    throw error;
  }
}

/**
 * Parses GADM HTML to extract country information
 */
function parseGADMHtml(html: string): GADMCountryInfo[] {
  // Updated regex for current GADM format
  // Format: <option value="AFG_Afghanistan_3">Afghanistan</option>
  // Pattern: ISO3_CountryName_AdminLevels
  const countryRegex =
    /<option\s+value="([A-Z]{3})_([^_]+)_(\d+)">([^<]+)<\/option>/g;

  let matches: RegExpExecArray | null;
  const foundCountries = new Map<string, GADMCountryInfo>();

  // Parse country options
  while ((matches = countryRegex.exec(html)) !== null) {
    const [, iso3, , numLevels, displayName] = matches;

    if (!iso3 || !numLevels || !displayName) {
      continue;
    }

    // Use a compound key to handle duplicates
    const key = `${iso3}_${displayName}`;
    if (!foundCountries.has(key)) {
      // Create admin levels array based on the number from GADM
      const adminLevels = Array.from(
        { length: parseInt(numLevels, 10) + 1 },
        (_, i) => i,
      );

      foundCountries.set(key, {
        iso3: iso3,
        iso2: "", // Will be populated later
        name: displayName.trim(),
        levels: adminLevels,
      });
    }
  }

  return Array.from(foundCountries.values());
}

/**
 * Maps ISO3 to ISO2 codes
 */
function mapISO3toISO2(iso3: string): string {
  const ISO3_TO_ISO2_MAP: Record<string, string> = {
    AFG: "AF",
    ALA: "AX",
    ALB: "AL",
    DZA: "DZ",
    ASM: "AS",
    AND: "AD",
    AGO: "AO",
    AIA: "AI",
    ATA: "AQ",
    ATG: "AG",
    ARG: "AR",
    ARM: "AM",
    ABW: "AW",
    AUS: "AU",
    AUT: "AT",
    AZE: "AZ",
    BHS: "BS",
    BHR: "BH",
    BGD: "BD",
    BRB: "BB",
    BLR: "BY",
    BEL: "BE",
    BLZ: "BZ",
    BEN: "BJ",
    BMU: "BM",
    BTN: "BT",
    BOL: "BO",
    BES: "BQ",
    BIH: "BA",
    BWA: "BW",
    BRA: "BR",
    BRN: "BN",
    BGR: "BG",
    BFA: "BF",
    BDI: "BI",
    CAN: "CA",
    CHL: "CL",
    CHN: "CN",
    COL: "CO",
    CRI: "CR",
    HRV: "HR",
    CUB: "CU",
    CYP: "CY",
    CZE: "CZ",
    DNK: "DK",
    ECU: "EC",
    EGY: "EG",
    SLV: "SV",
    EST: "EE",
    ETH: "ET",
    FIN: "FI",
    FRA: "FR",
    DEU: "DE",
    GHA: "GH",
    GRC: "GR",
    GTM: "GT",
    HND: "HN",
    HUN: "HU",
    ISL: "IS",
    IND: "IN",
    IDN: "ID",
    IRN: "IR",
    IRQ: "IQ",
    IRL: "IE",
    ISR: "IL",
    ITA: "IT",
    JAM: "JM",
    JPN: "JP",
    JOR: "JO",
    KAZ: "KZ",
    KEN: "KE",
    KOR: "KR",
    KWT: "KW",
    LVA: "LV",
    LBN: "LB",
    LBY: "LY",
    LTU: "LT",
    LUX: "LU",
    MYS: "MY",
    MEX: "MX",
    MAR: "MA",
    NLD: "NL",
    NZL: "NZ",
    NGA: "NG",
    NOR: "NO",
    PAK: "PK",
    PAN: "PA",
    PNG: "PG",
    PRY: "PY",
    PER: "PE",
    PHL: "PH",
    POL: "PL",
    PRT: "PT",
    ROU: "RO",
    RUS: "RU",
    SAU: "SA",
    SRB: "RS",
    SGP: "SG",
    SVK: "SK",
    SVN: "SI",
    ZAF: "ZA",
    ESP: "ES",
    LKA: "LK",
    SDN: "SD",
    SWE: "SE",
    CHE: "CH",
    SYR: "SY",
    TWN: "TW",
    TZA: "TZ",
    THA: "TH",
    TUN: "TN",
    TUR: "TR",
    UGA: "UG",
    UKR: "UA",
    ARE: "AE",
    GBR: "GB",
    USA: "US",
    URY: "UY",
    UZB: "UZ",
    VEN: "VE",
    VNM: "VN",
    YEM: "YE",
    ZMB: "ZM",
    ZWE: "ZW",
    KHM: "KH",
    LAO: "LA",
    MMR: "MM",
  };

  return ISO3_TO_ISO2_MAP[iso3] || "";
}

/**
 * Validates GADM country data
 */
function validateGADMCountry(country: GADMCountryInfo): boolean {
  return (
    country.iso3.length === 3 &&
    country.name.length > 0 &&
    country.levels.length > 0 &&
    country.levels.every((level) => level >= 0 && level <= 5)
  );
}
