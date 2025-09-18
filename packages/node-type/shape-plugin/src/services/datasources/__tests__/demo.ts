/**
     */

import { defaultDataSourceFactory, FetchOptions, OpenStreetMapStrategy } from '../index.js';

async function main() {
  console.log('=== Data Source Strategy Demo ===\n');

  console.log('Available strategies:');
  const strategies = defaultDataSourceFactory.getAllStrategyInfo();
  strategies.forEach(info => {
    console.log(`- ${info.name} (${info.id})`);
    console.log(`  Category: ${info.category}`);
    console.log(`  Coverage: ${info.coverageLevel}`);
    console.log(`  Data types: ${info.dataTypes.join(', ')}`);
    console.log(`  License: ${info.license}`);
    console.log('');
  });

  const stats = defaultDataSourceFactory.getStatistics();
  console.log('Factory Statistics:');
  console.log(`- Total strategies: ${stats.total}`);
  console.log(`- Supported strategies: ${stats.supported}`);
  console.log('- By category:', stats.byCategory);
  console.log('- By coverage level:', stats.byCoverageLevel);
  console.log('');

  console.log('Recommended strategies:');
  console.log(`- Administrative: ${defaultDataSourceFactory.getRecommendedStrategy('administrative')}`);
  console.log(`- Natural: ${defaultDataSourceFactory.getRecommendedStrategy('natural')}`);
  console.log(`- Realtime: ${defaultDataSourceFactory.getRecommendedStrategy('realtime')}`);
  console.log(`- Research: ${defaultDataSourceFactory.getRecommendedStrategy('research')}`);
  console.log('');

  console.log('=== Strategy Configurations ===\n');

  // Natural Earth
  console.log('1. Natural Earth Strategy:');
  const neStrategy = defaultDataSourceFactory.create('natural-earth-shapes');
  console.log(`- Base URL: ${neStrategy.config.access.baseUrl}`);
  console.log(`- Available endpoints:`, Object.keys(neStrategy.config.access.endpoints || {}));
  console.log(`- Cache TTL: ${neStrategy.config.cache?.ttl}ms`);
  console.log('');

  // GADM
  console.log('2. GADM Strategy:');
  const gadmStrategy = defaultDataSourceFactory.create('gadm-administrative-areas');
  console.log(`- Base URL: ${gadmStrategy.config.access.baseUrl}`);
  console.log(`- Timeout: ${gadmStrategy.config.access.timeout}ms`);
  console.log(`- Input format: ${gadmStrategy.config.processing.inputFormat}`);
  console.log('');

  // OpenStreetMap
  console.log('3. OpenStreetMap Strategy:');
  const osmStrategy = defaultDataSourceFactory.create('openstreetmap-overpass') as OpenStreetMapStrategy;
  console.log(`- Base URL: ${osmStrategy.config.access.baseUrl}`);
  console.log(`- Rate limit: ${osmStrategy.config.access.rateLimit?.requests} requests per ${osmStrategy.config.access.rateLimit?.period}ms`);
  console.log('- Available presets:', Object.keys(osmStrategy.getAvailablePresets()));
  console.log('');

  // GeoBoundaries
  console.log('4. GeoBoundaries Strategy:');
  const gbStrategy = defaultDataSourceFactory.create('geoboundaries-admin-areas');
  console.log(`- Base URL: ${gbStrategy.config.access.baseUrl}`);
  console.log(`- Available endpoints:`, Object.keys(gbStrategy.config.access.endpoints || {}));
  console.log(`- Cache TTL: ${gbStrategy.config.cache?.ttl}ms`);
  console.log('');

  //  OSM
  console.log('=== OSM Query Generation Demo ===\n');
  try {
    const bbox = { minLat: 35.0, maxLat: 36.0, minLng: 139.0, maxLng: 140.0 };

    console.log('Generated Overpass queries:');
    console.log('\n1. Countries query:');
    const countriesQuery = osmStrategy.buildPresetQuery('countries', bbox);
    console.log(countriesQuery.substring(0, 200) + '...\n');

    console.log('2. Administrative boundaries query:');
    const adminQuery = osmStrategy.buildPresetQuery('administrative', bbox);
    console.log(adminQuery.substring(0, 200) + '...\n');

    console.log('3. Cities query:');
    const citiesQuery = osmStrategy.buildPresetQuery('cities', bbox);
    console.log(citiesQuery.substring(0, 200) + '...\n');

  } catch (error) {
    console.error('Query generation error:', error);
  }

  console.log('=== Health Check Demo ===\n');
  try {
    console.log('Performing health checks...');
    const healthResults = await defaultDataSourceFactory.healthCheckAll();

    for (const [strategyId, isHealthy] of healthResults.entries()) {
      const status = isHealthy ? '✓ OK' : '✗ FAILED';
      console.log(`${strategyId}: ${status}`);
    }
    console.log('');

  } catch (error) {
    console.error('Health check error:', error);
  }

  console.log('=== Data Processing Flow Demo ===\n');
  try {
    console.log('Simulating data processing flow...');

    //  Natural Earth
    console.log('\n1. Natural Earth - Countries data:');
    const neOptions: FetchOptions = {
      endpoint: 'countries-50m',
      bbox: { minLat: 35, maxLat: 36, minLng: 139, maxLng: 140 },
    };

    console.log('Fetch options:', neOptions);
    console.log('Expected processing: Shapefile → GeoJSON conversion');
    console.log('Validation: Geometry and properties checks');
    console.log('');

    //  GADM
    console.log('2. GADM - Japan administrative areas:');
    const gadmOptions: FetchOptions = {
      country: 'JPN',
      adminLevel: 1,
    };

    console.log('Fetch options:', gadmOptions);
    console.log('Expected processing: GeoPackage → GeoJSON conversion');
    console.log('Validation: Administrative level and country checks');
    console.log('');

    //  GeoBoundaries
    console.log('3. GeoBoundaries - USA state boundaries:');
    const gbOptions: FetchOptions = {
      country: 'USA',
      adminLevel: 1,
    };

    console.log('Fetch options:', gbOptions);
    console.log('Expected processing: Direct GeoJSON processing');
    console.log('Validation: Shape name and metadata checks');
    console.log('');

  } catch (error) {
    console.error('Flow demo error:', error);
  }

  console.log('=== Demo Complete ===');
}

//  main
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main as runDemo };