import { getBuildDatabasePrefix, getDBName } from '@hierarchidb/util';
import { initializeShapeChunkStore } from '../services/utils/initializeShapeChunkStore.js';
import './components/steps-provider.js';
import './registerShapePluginResources.js';

initializeShapeChunkStore(getDBName(getBuildDatabasePrefix(), 'shape-chunks'));
