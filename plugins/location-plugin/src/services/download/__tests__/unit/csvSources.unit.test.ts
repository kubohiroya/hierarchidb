import { describe, expect, it } from 'vitest';
import type { Timestamp } from '@hierarchidb/core-types';
import {
  parseOpenFlightsCsv,
  parseOurAirportsCsv,
  parseWorldPortIndexCsv,
} from '~/services/download/csvSources';

describe('csvSources', () => {
  const timestamp = Date.now() as Timestamp;

  it('parses OurAirports CSV rows into airport points', async () => {
    const csv = [
      'id,ident,type,name,latitude_deg,longitude_deg,elevation_ft,continent,iso_country,country_name,iso_region,municipality,scheduled_service,gps_code,iata_code,local_code,home_link,wikipedia_link,keywords',
      '1,AAA,small_airport,Alpha Airport,35.1,139.2,100,AS,JP,Japan,JP-13,Tokyo,yes,AAAA,AAA,LOC,http://example.com,http://wiki,alpha',
    ].join('\n');
    const points = await parseOurAirportsCsv(csv, timestamp);
    expect(points).toHaveLength(1);
    expect(points[0].type).toBe('airport');
    expect(points[0].admin0Code).toBe('JP');
    expect(points[0].name).toBe('Alpha Airport');
    expect(points[0].metadata?.ourAirportsId).toBe('1');
    expect(points[0].metadata?.iataCode).toBe('AAA');
    expect(points[0].metadata?.airportCode).toBe('AAA');
    expect(points[0].admin0).toBe('Japan');
  });

  it('parses OpenFlights CSV rows into airport points', async () => {
    const csv = [
      '"1","Alpha Airport","Tokyo","Japan","AAA","AAAA",35.1,139.2,100,9,"U","Asia/Tokyo","airport","OurAirports"',
    ].join('\n');
    const points = await parseOpenFlightsCsv(csv, timestamp);
    expect(points).toHaveLength(1);
    expect(points[0].type).toBe('airport');
    expect(points[0].name).toBe('Alpha Airport');
    expect(points[0].metadata?.openFlightsId).toBe('1');
    expect(points[0].metadata?.iataCode).toBe('AAA');
    expect(points[0].metadata?.airportCode).toBe('AAA');
  });

  it('parses World Port Index CSV rows into port points', async () => {
    const csv = [
      'Main Port Name,Country Code,Region Name,Latitude,Longitude,UN/LOCODE,Harbor Size,Harbor Type,Shelter,Tide Range,Port Number',
      'Tokyo,Japan,Kanto,35.6,139.8,JPTKO,L,M,R,2,123',
    ].join('\n');
    const points = await parseWorldPortIndexCsv(csv, timestamp);
    expect(points).toHaveLength(1);
    expect(points[0].type).toBe('port');
    expect(points[0].admin0Code).toBe('');
    expect(points[0].admin0).toBe('Japan');
    expect(points[0].metadata?.worldPortIndexId).toBe('123');
    expect(points[0].metadata?.portCode).toBe('JPTKO');
  });
});
