import type { NodeId } from '@hierarchidb/core-types';
import { getDBName } from '@hierarchidb/util';
import type { YamlFileNodeData } from '@hierarchidb/yaml-api';
import { Dexie, type Table } from 'dexie';

export type YamlNodeRecord = YamlFileNodeData & { nodeId: NodeId; parentId: NodeId };

export class YamlDB extends Dexie {
  nodes!: Table<YamlNodeRecord, NodeId>;

  constructor() {
    super(getDBName('yaml'));
    this.version(1).stores({ nodes: '&nodeId, parentId' });
    this.nodes = this.table('nodes');
  }
}

let singleton: YamlDB | null = null;
let legacyYamlAccessRevoked = false;

export function getYamlDB(): YamlDB {
  if (legacyYamlAccessRevoked) {
    throw new Error('legacy-yaml-access-revoked');
  }
  if (!singleton) singleton = new YamlDB();
  return singleton;
}

export function revokeLegacyYamlAccessAndClose(): void {
  legacyYamlAccessRevoked = true;
  if (singleton === null) return;
  singleton.close();
  singleton = null;
}
