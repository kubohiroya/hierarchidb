// Test setup file
import { expect, test, describe, it, beforeEach, afterEach } from 'vitest'

// Make vitest globals available
globalThis.expect = expect
globalThis.test = test
globalThis.describe = describe
globalThis.it = it
globalThis.beforeEach = beforeEach
globalThis.afterEach = afterEach

// File API polyfill for Vitest environment
if (typeof File !== 'undefined' && !File.prototype.arrayBuffer) {
  File.prototype.arrayBuffer = function() {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.readAsArrayBuffer(this);
    });
  };
}

if (typeof File !== 'undefined' && !File.prototype.text) {
  File.prototype.text = function() {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsText(this);
    });
  };
}