import type { 
  CountryMetadata, 
  DataSourceConfig, 
  DownloadTask, 
  SimplifyTask, 
  VectorTileTask,
  UrlMetadata 
} from '~/types';
import { BatchTaskStage } from '~/types';

// ================================
// Data Source Configurations
// ================================

export const DATA_SOURCE_CONFIGS: Record<string, DataSourceConfig> = {
  naturalearth: {
    name: 'naturalearth',
    displayName: 'Natural Earth',
    description: 'Public domain map dataset available at scales suitable for world, regional, and country maps',
    license: 'Public Domain',
    licenseUrl: 'https://www.naturalearthdata.com/about/terms-of-use/',
    attribution: 'Made with Natural Earth',
    color: '#4CAF50',
    icon: '🌍',
    maxAdminLevel: 1,
  },
  geoboundaries: {
    name: 'geoboundaries',
    displayName: 'geoBoundaries',
    description: 'Open-source administrative boundaries for every country in the world',
    license: 'Creative Commons BY 4.0',
    licenseUrl: 'https://www.geoboundaries.org/index.html#getdata',
    attribution: 'Data from geoBoundaries.org',
    color: '#2196F3',
    icon: '🗺️',
    maxAdminLevel: 3,
  },
  gadm: {
    name: 'gadm',
    displayName: 'GADM',
    description: 'Database of Global Administrative Areas with detailed administrative boundaries',
    license: 'Academic use only',
    licenseUrl: 'https://gadm.org/license.html',
    attribution: 'Data from GADM.org',
    color: '#FF9800',
    icon: '📊',
    maxAdminLevel: 5,
  },
  openstreetmap: {
    name: 'openstreetmap',
    displayName: 'OpenStreetMap',
    description: 'Community-driven open geographic database of the world',
    license: 'ODbL 1.0',
    licenseUrl: 'https://www.openstreetmap.org/copyright',
    attribution: '© OpenStreetMap contributors',
    color: '#9C27B0',
    icon: '🚗',
    maxAdminLevel: 4,
  },
};

// ================================
// Country Metadata Sample
// ================================

export const SAMPLE_COUNTRIES: CountryMetadata[] = [
  // Asia
  {
    countryCode: 'JPN',
    countryName: 'Japan',
    continent: 'Asia',
    availableAdminLevels: [0, 1, 2, 3],
    population: 125800000,
    area: 377975,
    dataQuality: 'high',
  },
  {
    countryCode: 'CHN',
    countryName: 'China',
    continent: 'Asia',
    availableAdminLevels: [0, 1, 2, 3, 4],
    population: 1444216107,
    area: 9596961,
    dataQuality: 'high',
  },
  {
    countryCode: 'IND',
    countryName: 'India',
    continent: 'Asia',
    availableAdminLevels: [0, 1, 2, 3],
    population: 1393409038,
    area: 3287263,
    dataQuality: 'high',
  },
  {
    countryCode: 'KOR',
    countryName: 'South Korea',
    continent: 'Asia',
    availableAdminLevels: [0, 1, 2],
    population: 51780579,
    area: 100210,
    dataQuality: 'high',
  },
  
  // Europe
  {
    countryCode: 'DEU',
    countryName: 'Germany',
    continent: 'Europe',
    availableAdminLevels: [0, 1, 2, 3],
    population: 83190556,
    area: 357022,
    dataQuality: 'high',
  },
  {
    countryCode: 'FRA',
    countryName: 'France',
    continent: 'Europe',
    availableAdminLevels: [0, 1, 2, 3],
    population: 67391582,
    area: 643801,
    dataQuality: 'high',
  },
  {
    countryCode: 'GBR',
    countryName: 'United Kingdom',
    continent: 'Europe',
    availableAdminLevels: [0, 1, 2, 3],
    population: 67886011,
    area: 242495,
    dataQuality: 'high',
  },
  {
    countryCode: 'ITA',
    countryName: 'Italy',
    continent: 'Europe',
    availableAdminLevels: [0, 1, 2, 3],
    population: 60461826,
    area: 301340,
    dataQuality: 'high',
  },
  
  // Americas
  {
    countryCode: 'USA',
    countryName: 'United States',
    continent: 'North America',
    availableAdminLevels: [0, 1, 2, 3],
    population: 331002651,
    area: 9833517,
    dataQuality: 'high',
  },
  {
    countryCode: 'CAN',
    countryName: 'Canada',
    continent: 'North America',
    availableAdminLevels: [0, 1, 2],
    population: 37742154,
    area: 9984670,
    dataQuality: 'high',
  },
  {
    countryCode: 'MEX',
    countryName: 'Mexico',
    continent: 'North America',
    availableAdminLevels: [0, 1, 2],
    population: 128932753,
    area: 1964375,
    dataQuality: 'medium',
  },
  {
    countryCode: 'BRA',
    countryName: 'Brazil',
    continent: 'South America',
    availableAdminLevels: [0, 1, 2, 3],
    population: 212559417,
    area: 8515767,
    dataQuality: 'high',
  },
  {
    countryCode: 'ARG',
    countryName: 'Argentina',
    continent: 'South America',
    availableAdminLevels: [0, 1, 2],
    population: 45195774,
    area: 2780400,
    dataQuality: 'medium',
  },
  
  // Africa
  {
    countryCode: 'NGA',
    countryName: 'Nigeria',
    continent: 'Africa',
    availableAdminLevels: [0, 1, 2],
    population: 206139589,
    area: 923768,
    dataQuality: 'medium',
  },
  {
    countryCode: 'ZAF',
    countryName: 'South Africa',
    continent: 'Africa',
    availableAdminLevels: [0, 1, 2],
    population: 59308690,
    area: 1221037,
    dataQuality: 'medium',
  },
  {
    countryCode: 'EGY',
    countryName: 'Egypt',
    continent: 'Africa',
    availableAdminLevels: [0, 1, 2],
    population: 102334404,
    area: 1001450,
    dataQuality: 'medium',
  },
  
  // Oceania
  {
    countryCode: 'AUS',
    countryName: 'Australia',
    continent: 'Oceania',
    availableAdminLevels: [0, 1, 2],
    population: 25499884,
    area: 7692024,
    dataQuality: 'high',
  },
  {
    countryCode: 'NZL',
    countryName: 'New Zealand',
    continent: 'Oceania',
    availableAdminLevels: [0, 1, 2],
    population: 4822233,
    area: 268838,
    dataQuality: 'high',
  },
];

// ================================
// Sample URL Metadata
// ================================

export function generateUrlMetadata(
  countries: string[],
  adminLevels: number[],
  dataSource: string
): UrlMetadata[] {
  const metadata: UrlMetadata[] = [];
  
  countries.forEach(countryCode => {
    const country = SAMPLE_COUNTRIES.find(c => c.countryCode === countryCode);
    if (!country) return;
    
    adminLevels.forEach(level => {
      if (level <= (country.availableAdminLevels?.slice(-1)[0] || 0)) {
        metadata.push({
          url: `https://example.com/${dataSource}/${countryCode}/admin${level}.geojson`,
          countryCode,
          adminLevel: level,
          continent: country.continent,
          estimatedSize: Math.floor(Math.random() * 10000000) + 500000, // 0.5MB - 10MB
          lastUpdated: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
        });
      }
    });
  });
  
  return metadata;
}

// ================================
// Sample Batch Tasks
// ================================

let taskIdCounter = 1;

export function generateMockDownloadTasks(urlMetadata: UrlMetadata[]): DownloadTask[] {
  return urlMetadata.slice(0, 5).map(meta => {
    const stages = [BatchTaskStage.SUCCESS, BatchTaskStage.PROCESS, BatchTaskStage.WAIT];
    const stage = stages[Math.floor(Math.random() * 3)] as BatchTaskStage;
    
    return {
      taskId: `download-${taskIdCounter++}`,
      taskType: 'download' as const,
      stage,
      progress: Math.random() * 100,
      url: meta.url,
      countryCode: meta.countryCode,
      adminLevel: meta.adminLevel,
      fileSize: meta.estimatedSize,
      downloadedBytes: Math.floor((meta.estimatedSize || 1000000) * Math.random()),
      startedAt: Date.now() - Math.random() * 3600000,
    };
  });
}

export function generateMockSimplifyTasks(countries: string[], adminLevels: number[]): SimplifyTask[] {
  const tasks: SimplifyTask[] = [];
  
  countries.slice(0, 3).forEach(countryCode => {
    adminLevels.slice(0, 2).forEach(level => {
      tasks.push({
        taskId: `simplify1-${taskIdCounter++}`,
        taskType: 'simplify1',
        stage: BatchTaskStage.WAIT,
        countryCode,
        adminLevel: level,
        featureCount: Math.floor(Math.random() * 10000) + 1000,
        processedFeatures: 0,
      });
    });
  });
  
  return tasks;
}

export function generateMockVectorTileTasks(countries: string[], adminLevels: number[]): VectorTileTask[] {
  const tasks: VectorTileTask[] = [];
  
  countries.slice(0, 2).forEach(countryCode => {
    adminLevels.slice(0, 1).forEach(level => {
      for (let zoom = 8; zoom <= 12; zoom++) {
        tasks.push({
          taskId: `vectortile-${taskIdCounter++}`,
          taskType: 'vectortile',
          stage: BatchTaskStage.WAIT,
          countryCode,
          adminLevel: level,
          zoomLevel: zoom,
          tileCount: Math.pow(4, zoom - 8) * 10,
          generatedTiles: 0,
        });
      }
    });
  });
  
  return tasks;
}

// ================================
// Sample Selection Matrix
// ================================

export function generateSampleCheckboxMatrix(
  countryCount: number,
  maxAdminLevel: number
): boolean[][] {
  const matrix: boolean[][] = [];
  
  for (let i = 0; i < countryCount; i++) {
    const row: boolean[] = [];
    for (let j = 0; j <= maxAdminLevel; j++) {
      // Random selection with decreasing probability for higher levels
      row.push(Math.random() < (0.3 - j * 0.05));
    }
    matrix.push(row);
  }
  
  return matrix;
}

// ================================
// Utility Functions
// ================================

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

export function calculateEstimatedSize(totalSelections: number): number {
  // Rough estimate: 5MB per selection on average
  return totalSelections * 5 * 1024 * 1024;
}

export function calculateEstimatedFeatures(
  totalSelections: number,
  countries: CountryMetadata[]
): number {
  // Rough estimate based on population density
  const avgPopulation = countries.reduce((sum, c) => sum + (c.population || 0), 0) / countries.length;
  const featuresPerMillion = 100; // Rough estimate
  return Math.floor(totalSelections * (avgPopulation / 1000000) * featuresPerMillion);
}

export function calculateEstimatedProcessingTime(totalSelections: number): string {
  // Rough estimate: 30 seconds per selection
  const seconds = totalSelections * 30;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}