import 'fake-indexeddb/auto';

// Mock DOM APIs needed by MapLibre GL
Object.defineProperty(window, 'URL', {
  value: {
    createObjectURL: () => 'mocked-url',
    revokeObjectURL: () => {}
  }
});

Object.defineProperty(window, 'Blob', {
  value: class MockBlob {
    constructor(data: any[], options?: any) {}
  }
});

// Mock Worker for MapLibre GL
Object.defineProperty(window, 'Worker', {
  value: class MockWorker {
    constructor(url: string) {}
    postMessage() {}
    terminate() {}
    onmessage = null;
    onerror = null;
  }
});