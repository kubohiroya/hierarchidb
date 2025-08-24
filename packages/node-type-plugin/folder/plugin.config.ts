export default {
  name: 'folder',
  version: '1.0.0',
  description: 'Hierarchical folder management plugin',
  author: 'HierarchiDB Team',
  dependencies: ['@hierarchidb/common-core', '@hierarchidb/runtime-worker', 'dexie'],
  peerDependencies: {
    '@hierarchidb/common-core': '^1.0.0',
    '@hierarchidb/runtime-worker': '^1.0.0',
  },
  lifecycle: {
    onLoad: () => console.log('Folder plugin loaded'),
    onUnload: () => console.log('Folder plugin unloaded'),
  },
  settings: {
    ui: {
      showTemplates: true,
      showBookmarks: true,
      maxBookmarksPerFolder: 100,
    },
    performance: {
      cacheSize: 1000,
      cleanupInterval: 3600000,
    },
  },
};
