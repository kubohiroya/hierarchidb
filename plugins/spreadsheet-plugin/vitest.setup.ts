import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import '../../vitest.database-prefix.setup.ts';
import { Blob, File } from 'node:buffer';

type GlobalFileTarget = typeof globalThis & {
  Blob?: typeof Blob;
  File?: typeof File;
  window?: { Blob?: typeof Blob; File?: typeof File };
};
const globalTarget: GlobalFileTarget = globalThis;

if (typeof globalTarget.Blob === 'undefined') {
  globalTarget.Blob = Blob;
}
if (typeof globalTarget.File === 'undefined') {
  globalTarget.File = File;
}
if (globalTarget.window) {
  if (typeof globalTarget.window.Blob === 'undefined') {
    globalTarget.window.Blob = Blob;
  }
  if (typeof globalTarget.window.File === 'undefined') {
    globalTarget.window.File = File;
  }
}
