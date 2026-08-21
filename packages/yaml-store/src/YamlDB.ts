import type { NodeId } from '@hierarchidb/core-types';
import { getBuildDatabasePrefix, getDBName } from '@hierarchidb/util';
import type { YamlFileNodeData } from '@hierarchidb/yaml-api';
import { Dexie, type Table } from 'dexie';
import {
  assertLegacyYamlAccessAllowed,
  registerLegacyYamlDatabaseClose,
} from './legacyYamlAccessGateUtils.js';

export { revokeLegacyYamlAccessAndClose } from './legacyYamlAccessGateUtils.js';

export type YamlNodeRecord = YamlFileNodeData & { nodeId: NodeId; parentId: NodeId };

export class YamlDB extends Dexie {
  nodes!: Table<YamlNodeRecord, NodeId>;

  constructor(databaseName: string) {
    super(databaseName);
    this.version(1).stores({ nodes: '&nodeId, parentId' });
    this.nodes = this.table('nodes');
  }
}

let singleton: YamlDB | null = null;

export function getYamlDB(): YamlDB {
  assertLegacyYamlAccessAllowed();
  if (!singleton) {
    singleton = new YamlDB(getDBName(getBuildDatabasePrefix(), 'yaml'));
    registerLegacyYamlDatabaseClose(() => {
      singleton?.close();
      singleton = null;
    });
  }
  return singleton;
}
