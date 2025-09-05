import Dexie, { type Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';
import type { EntityId } from '@hierarchidb/common-type';
import type {
  ProjectEntity,
  ProjectSnapshot,
  AnalysisResult,
  ProjectTile
} from '~/types/project-types';

export class ProjectDatabase extends Dexie {
  projects!: Table<ProjectEntity, EntityId>;
  snapshots!: Table<ProjectSnapshot, EntityId>;
  analysisResults!: Table<AnalysisResult, EntityId>;
  tiles!: Table<ProjectTile, string>;

  constructor() {
    super(getDBName('project-db'));
    
    this.version(1).stores({
      // プロジェクトエンティティ
      projects: '&id, nodeId, name, category, [category+name], createdAt, updatedAt',
      
      // スナップショット
      snapshots: '&id, projectEntityId, [projectEntityId+timestamp], timestamp, isBaseline',
      
      // 解析結果
      analysisResults: '&id, projectEntityId, analysisId, [projectEntityId+analysisId], executedAt, status',
      
      // タイルキャッシュ
      tiles: '&id, projectEntityId, [projectEntityId+zoom+x+y], generatedAt, lastAccessed'
    });
  }

  async clearProjectData(projectEntityId: EntityId): Promise<void> {
    await this.transaction('rw', this.snapshots, this.analysisResults, this.tiles, async () => {
      await this.snapshots.where('projectEntityId').equals(projectEntityId).delete();
      await this.analysisResults.where('projectEntityId').equals(projectEntityId).delete();
      await this.tiles.where('projectEntityId').equals(projectEntityId).delete();
    });
  }

  async getProjectWithRelatedData(projectEntityId: EntityId) {
    const project = await this.projects.get(projectEntityId);
    if (!project) return null;

    const [snapshots, analysisResults] = await Promise.all([
      this.snapshots.where('projectEntityId').equals(projectEntityId).toArray(),
      this.analysisResults.where('projectEntityId').equals(projectEntityId).toArray()
    ]);

    return {
      project,
      snapshots,
      analysisResults
    };
  }

  async getTile(projectEntityId: EntityId, zoom: number, x: number, y: number): Promise<ProjectTile | undefined> {
    const tileId = `${projectEntityId}/${zoom}/${x}/${y}`;
    const tile = await this.tiles.get(tileId);
    
    if (tile) {
      // Update access metadata
      await this.tiles.update(tileId, {
        lastAccessed: Date.now(),
        accessCount: (tile.accessCount || 0) + 1
      });
    }
    
    return tile;
  }

  async putTile(tile: ProjectTile): Promise<void> {
    await this.tiles.put(tile);
  }

  async cleanExpiredTiles(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    const threshold = Date.now() - maxAge;
    await this.tiles.where('lastAccessed').below(threshold).delete();
  }

  async getProjectStatistics(projectEntityId: EntityId) {
    const [snapshotCount, analysisCount, tileCount] = await Promise.all([
      this.snapshots.where('projectEntityId').equals(projectEntityId).count(),
      this.analysisResults.where('projectEntityId').equals(projectEntityId).count(),
      this.tiles.where('projectEntityId').equals(projectEntityId).count()
    ]);

    const tileSizes = await this.tiles
      .where('projectEntityId')
      .equals(projectEntityId)
      .toArray()
      .then(tiles => tiles.reduce((sum, tile) => sum + tile.size, 0));

    return {
      snapshotCount,
      analysisCount,
      tileCount,
      totalTileSize: tileSizes
    };
  }
}

export const projectDB = new ProjectDatabase();
