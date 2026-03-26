import { getDBName } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/core-types';
import { Dexie, type Table } from 'dexie';
import type { YamlFileNodeData } from '@hierarchidb/yaml-api';

export type YamlNodeRecord = YamlFileNodeData & { nodeId: NodeId };

export class YamlDB extends Dexie {
    nodes: Table<YamlNodeRecord, NodeId>;

    constructor() {
        super(getDBName('yaml'));
        this.version(1).stores({ nodes: '&nodeId' });
        this.nodes = this.table('nodes');
    }
}

let singleton: YamlDB | null = null;

export function getYamlDB(): YamlDB {
    if (!singleton) singleton = new YamlDB();
    return singleton;
}
