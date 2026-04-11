import type { Timestamp } from '@hierarchidb/core-types';
import type { LocationPointProperties } from '~/common/entities/LocationPoint';
import { parseNumber } from './mapperUtils.js';
import { buildHeaderIndex, getColumnValue, parseCsvTable } from './csvDownloadUtils.js';
import {
  buildOpenFlightsPointProperties,
  buildOurAirportsPointProperties,
  buildWorldPortIndexPointProperties,
} from '~/services/pointFactoryUtils';

export const parseOurAirportsCsv = async (
  text: string,
  timestamp: Timestamp,
): Promise<LocationPointProperties[]> => {
  const { headers, rows } = parseCsvTable(text, { hasHeader: true });
  if (headers.length === 0) return [];
  const headerIndex = buildHeaderIndex(headers);
  const mapped = await Promise.all(rows.map(async (row: string[]) => {
    const id = getColumnValue(row, headerIndex, 'id');
    const name = getColumnValue(row, headerIndex, 'name');
    const lat = parseNumber(getColumnValue(row, headerIndex, 'latitude_deg', 'latitude'));
    const lon = parseNumber(getColumnValue(row, headerIndex, 'longitude_deg', 'longitude'));
    if (!id || !name || lat == null || lon == null) return null;
    return buildOurAirportsPointProperties({
      id,
      name,
      latitude: lat,
      longitude: lon,
      ident: getColumnValue(row, headerIndex, 'ident'),
      type: getColumnValue(row, headerIndex, 'type'),
      iataCode: getColumnValue(row, headerIndex, 'iata_code', 'iata'),
      icaoCode: getColumnValue(row, headerIndex, 'gps_code', 'icao'),
      localCode: getColumnValue(row, headerIndex, 'local_code'),
      municipality: getColumnValue(row, headerIndex, 'municipality'),
      isoCountry: getColumnValue(row, headerIndex, 'iso_country'),
      countryName: getColumnValue(row, headerIndex, 'admin0_name', 'country_name', 'country'),
      isoRegion: getColumnValue(row, headerIndex, 'iso_region'),
      scheduledService: getColumnValue(row, headerIndex, 'scheduled_service'),
      elevationFt: parseNumber(getColumnValue(row, headerIndex, 'elevation_ft')),
      continent: getColumnValue(row, headerIndex, 'continent'),
      homeLink: getColumnValue(row, headerIndex, 'home_link'),
      wikipediaLink: getColumnValue(row, headerIndex, 'wikipedia_link'),
      keywords: getColumnValue(row, headerIndex, 'keywords'),
    }, timestamp);
  }));
  return mapped.filter((row): row is LocationPointProperties => Boolean(row));
};

export const parseOpenFlightsCsv = async (
  text: string,
  timestamp: Timestamp,
): Promise<LocationPointProperties[]> => {
  const { rows } = parseCsvTable(text, { hasHeader: false });
  if (rows.length === 0) return [];
  const mapped = await Promise.all(rows.map(async (row: string[]) => {
    const id = row[0];
    const name = row[1];
    const city = row[2];
    const country = row[3];
    const iata = row[4];
    const icao = row[5];
    const lat = parseNumber(row[6]);
    const lon = parseNumber(row[7]);
    const altitude = parseNumber(row[8]);
    const timezone = parseNumber(row[9]);
    const dst = row[10];
    const tz = row[11];
    const type = row[12];
    const source = row[13];
    if (!id || !name || lat == null || lon == null) return null;
    return buildOpenFlightsPointProperties({
      id,
      name,
      latitude: lat,
      longitude: lon,
      city,
      country,
      iata,
      icao,
      altitude,
      timezone,
      dst,
      tz,
      type,
      source,
    }, timestamp);
  }));
  return mapped.filter((row): row is LocationPointProperties => Boolean(row));
};

export const parseWorldPortIndexCsv = async (
  text: string,
  timestamp: Timestamp,
): Promise<LocationPointProperties[]> => {
  const { headers, rows } = parseCsvTable(text, { hasHeader: true });
  if (headers.length === 0) return [];
  const headerIndex = buildHeaderIndex(headers);
  const mapped = await Promise.all(rows.map(async (row: string[]) => {
    const name = getColumnValue(row, headerIndex, 'port_name', 'portname', 'main_port_name', 'mainportname', 'name');
    const lat = parseNumber(getColumnValue(row, headerIndex, 'latitude', 'lat'));
    const lon = parseNumber(getColumnValue(row, headerIndex, 'longitude', 'lon', 'lng'));
    if (!name || lat == null || lon == null) return null;
    const rawCountryCode = getColumnValue(
      row,
      headerIndex,
      'country_code',
      'countrycode',
      'iso2',
      'countryalpha2',
    );
    const rawCountryName = getColumnValue(row, headerIndex, 'country', 'country_name', 'countrycode');
    const admin0Code = rawCountryCode && rawCountryCode.length === 2
      ? rawCountryCode
      : undefined;
    const admin0Name = rawCountryName && (!admin0Code || rawCountryName.length > 2)
      ? rawCountryName
      : undefined;
    return buildWorldPortIndexPointProperties({
      id: getColumnValue(row, headerIndex, 'port_number', 'portnumber', 'port_id'),
      name,
      latitude: lat,
      longitude: lon,
      countryCode: admin0Code,
      countryName: admin0Name,
      regionName: getColumnValue(row, headerIndex, 'region_name', 'region'),
      unlocode: getColumnValue(row, headerIndex, 'un/locode', 'unlocode', 'locode'),
      harborSize: getColumnValue(row, headerIndex, 'harbor_size', 'harborsize'),
      harborType: getColumnValue(row, headerIndex, 'harbor_type', 'harbortype'),
      shelter: getColumnValue(row, headerIndex, 'shelter'),
      tideRange: getColumnValue(row, headerIndex, 'tide_range', 'tiderange'),
    }, timestamp);
  }));
  return mapped.filter((row): row is LocationPointProperties => Boolean(row));
};
