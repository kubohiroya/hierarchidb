import { describe, expect, it } from 'vitest';
import type { Timestamp } from '@hierarchidb/common-types';
import {
  parseOpenFlightsCsv,
  parseOurAirportsCsv,
  parseWorldPortIndexCsv,
} from '../../csvSources.js';

describe('csvSources', () => {
  const timestamp = Date.now() as Timestamp;

  it('parses OurAirports CSV rows into airport points', () => {
    const csv = [
      'id,ident,type,name,latitude_deg,longitude_deg,elevation_ft,continent,iso_country,iso_region,municipality,scheduled_service,gps_code,iata_code,local_code,home_link,wikipedia_link,keywords',
      '1,AAA,small_airport,Alpha Airport,35.1,139.2,100,AS,JP,JP-13,Tokyo,yes,AAAA,AAA,LOC,http://example.com,http://wiki,alpha',
    ].join('\n');
    const points = parseOurAirportsCsv(csv, timestamp);
    expect(points).toHaveLength(1);
    expect(points[0].kind).toBe('airport');
    expect(points[0].countryCode).toBe('JP');
    expect(points[0].name).toBe('Alpha Airport');
    expect(points[0].metadata?.ourAirportsId).toBe('1');
    expect(points[0].metadata?.iataCode).toBe('AAA');
  });

  it('parses OpenFlights CSV rows into airport points', () => {
    const csv = [
      '"1","Alpha Airport","Tokyo","Japan","AAA","AAAA",35.1,139.2,100,9,"U","Asia/Tokyo","airport","OurAirports"',
    ].join('\n');
    const points = parseOpenFlightsCsv(csv, timestamp);
    expect(points).toHaveLength(1);
    expect(points[0].kind).toBe('airport');
    expect(points[0].name).toBe('Alpha Airport');
    expect(points[0].metadata?.openFlightsId).toBe('1');
    expect(points[0].metadata?.iataCode).toBe('AAA');
  });

  it('parses World Port Index CSV rows into port points', () => {
    const csv = [
      'port_name,country,latitude,longitude,harbor_size,harbor_type,shelter,tide_range,port_number,country_code',
      'Tokyo,Japan,35.6,139.8,L,M,R,2,123,JP',
    ].join('\n');
    const points = parseWorldPortIndexCsv(csv, timestamp);
    expect(points).toHaveLength(1);
    expect(points[0].kind).toBe('port');
    expect(points[0].countryCode).toBe('JP');
    expect(points[0].metadata?.worldPortIndexId).toBe('123');
  });
});
