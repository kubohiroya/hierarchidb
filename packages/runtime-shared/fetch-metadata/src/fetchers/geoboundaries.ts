import type { RegionMetadata } from "../utils/types";
import { saveMetadata } from "../utils/utils";

interface GeoBoundariesCountry {
  iso3: string;
  iso2: string;
  name: string;
  boundaryType: string;
  adminLevels: number[];
}

/**
 * Fetch metadata from geoBoundaries
 * geoBoundaries provides open administrative boundary data for every country
 */
export async function fetchGeoBoundaries(
  outputDirName: string,
  outputFileName: string,
): Promise<void> {
  console.log("📊 Fetching geoBoundaries metadata...");

  const metadata: RegionMetadata[] = [];

  try {
    // geoBoundaries API endpoint for all countries
    const apiUrl = "https://www.geoboundaries.org/api/current/gbOpen/ALL/ALL/";

    console.log("Fetching geoBoundaries country list...");
    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Parse the API response
    const countries = await parseGeoBoundariesAPI(data);
    console.log(`Found ${countries.length} countries`);

    // Convert to RegionMetadata format
    for (const country of countries) {
      if (validateGeoBoundariesCountry(country)) {
        const regionData: RegionMetadata = {
          id: country.iso3,
          name: country.name,
          countryName: country.name,
          countryCode: country.iso2,
          iso2: country.iso2,
          iso3: country.iso3,
          continent: "", // geoBoundaries doesn't provide continent info directly
          region: "",
          subregion: "",
          adminLevels: country.adminLevels,
          numAdminLevels: country.adminLevels.length,
          bbox: [-180, -90, 180, 90], // Would need additional API calls for actual bbox
        };

        metadata.push(regionData);
      }
    }

    console.log(`Valid countries: ${metadata.length}`);

    // Sort by name
    metadata.sort((a, b) => a.name.localeCompare(b.name));

    await saveMetadata(metadata, outputDirName, outputFileName);
  } catch (error) {
    console.error("Error fetching geoBoundaries data:", error);
    throw error;
  }
}

/**
 * Parse geoBoundaries API response
 */
async function parseGeoBoundariesAPI(
  data: any,
): Promise<GeoBoundariesCountry[]> {
  const countries = new Map<string, GeoBoundariesCountry>();

  // The API returns an array of boundary records
  if (Array.isArray(data)) {
    for (const record of data) {
      if (record.boundaryISO && record.boundaryName) {
        const iso3 = record.boundaryISO;
        const name = record.boundaryName;
        const boundaryType = record.boundaryType || "ADM0";

        // Extract admin level from boundary type (ADM0, ADM1, ADM2, etc.)
        const levelMatch = boundaryType.match(/ADM(\d+)/);
        const adminLevel = levelMatch ? parseInt(levelMatch[1], 10) : 0;

        if (!countries.has(iso3)) {
          countries.set(iso3, {
            iso3,
            iso2: mapISO3toISO2(iso3),
            name,
            boundaryType,
            adminLevels: [adminLevel],
          });
        } else {
          const country = countries.get(iso3)!;
          if (!country.adminLevels.includes(adminLevel)) {
            country.adminLevels.push(adminLevel);
          }
        }
      }
    }
  }

  // Sort admin levels for each country
  for (const country of countries.values()) {
    country.adminLevels.sort((a, b) => a - b);
  }

  return Array.from(countries.values());
}

/**
 * Maps ISO3 to ISO2 codes
 */
function mapISO3toISO2(iso3: string): string {
  const ISO3_TO_ISO2_MAP: Record<string, string> = {
    AFG: "AF",
    ALB: "AL",
    DZA: "DZ",
    ARG: "AR",
    ARM: "AM",
    AUS: "AU",
    AUT: "AT",
    BGD: "BD",
    BEL: "BE",
    BEN: "BJ",
    BTN: "BT",
    BOL: "BO",
    BIH: "BA",
    BWA: "BW",
    BRA: "BR",
    BGR: "BG",
    BFA: "BF",
    BDI: "BI",
    KHM: "KH",
    CMR: "CM",
    CAN: "CA",
    CAF: "CF",
    TCD: "TD",
    CHL: "CL",
    CHN: "CN",
    COL: "CO",
    COM: "KM",
    COG: "CG",
    COD: "CD",
    CRI: "CR",
    CIV: "CI",
    HRV: "HR",
    CUB: "CU",
    CYP: "CY",
    CZE: "CZ",
    DNK: "DK",
    DJI: "DJ",
    DOM: "DO",
    ECU: "EC",
    EGY: "EG",
    SLV: "SV",
    GNQ: "GQ",
    ERI: "ER",
    EST: "EE",
    ETH: "ET",
    FJI: "FJ",
    FIN: "FI",
    FRA: "FR",
    GAB: "GA",
    GMB: "GM",
    GEO: "GE",
    DEU: "DE",
    GHA: "GH",
    GRC: "GR",
    GTM: "GT",
    GIN: "GN",
    GNB: "GW",
    GUY: "GY",
    HTI: "HT",
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
    KIR: "KI",
    PRK: "KP",
    KOR: "KR",
    XKX: "XK",
    KWT: "KW",
    KGZ: "KG",
    LAO: "LA",
    LVA: "LV",
    LBN: "LB",
    LSO: "LS",
    LBR: "LR",
    LBY: "LY",
    LIE: "LI",
    LTU: "LT",
    LUX: "LU",
    MKD: "MK",
    MDG: "MG",
    MWI: "MW",
    MYS: "MY",
    MDV: "MV",
    MLI: "ML",
    MLT: "MT",
    MRT: "MR",
    MUS: "MU",
    MEX: "MX",
    FSM: "FM",
    MDA: "MD",
    MCO: "MC",
    MNG: "MN",
    MNE: "ME",
    MAR: "MA",
    MOZ: "MZ",
    MMR: "MM",
    NAM: "NA",
    NRU: "NR",
    NPL: "NP",
    NLD: "NL",
    NZL: "NZ",
    NIC: "NI",
    NER: "NE",
    NGA: "NG",
    NOR: "NO",
    OMN: "OM",
    PAK: "PK",
    PLW: "PW",
    PSE: "PS",
    PAN: "PA",
    PNG: "PG",
    PRY: "PY",
    PER: "PE",
    PHL: "PH",
    POL: "PL",
    PRT: "PT",
    QAT: "QA",
    ROU: "RO",
    RUS: "RU",
    RWA: "RW",
    KNA: "KN",
    LCA: "LC",
    VCT: "VC",
    WSM: "WS",
    SMR: "SM",
    STP: "ST",
    SAU: "SA",
    SEN: "SN",
    SRB: "RS",
    SYC: "SC",
    SLE: "SL",
    SGP: "SG",
    SVK: "SK",
    SVN: "SI",
    SLB: "SB",
    SOM: "SO",
    ZAF: "ZA",
    SSD: "SS",
    ESP: "ES",
    LKA: "LK",
    SDN: "SD",
    SUR: "SR",
    SWZ: "SZ",
    SWE: "SE",
    CHE: "CH",
    SYR: "SY",
    TWN: "TW",
    TJK: "TJ",
    TZA: "TZ",
    THA: "TH",
    TLS: "TL",
    TGO: "TG",
    TON: "TO",
    TTO: "TT",
    TUN: "TN",
    TUR: "TR",
    TKM: "TM",
    TUV: "TV",
    UGA: "UG",
    UKR: "UA",
    ARE: "AE",
    GBR: "GB",
    USA: "US",
    URY: "UY",
    UZB: "UZ",
    VUT: "VU",
    VEN: "VE",
    VNM: "VN",
    YEM: "YE",
    ZMB: "ZM",
    ZWE: "ZW",
  };

  return ISO3_TO_ISO2_MAP[iso3] || "";
}

/**
 * Validates geoBoundaries country data
 */
function validateGeoBoundariesCountry(country: GeoBoundariesCountry): boolean {
  return (
    country.iso3.length === 3 &&
    country.name.length > 0 &&
    country.adminLevels.length > 0
  );
}
