import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { Blob, File } from 'node:buffer';

const globalTarget = globalThis as any;

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
