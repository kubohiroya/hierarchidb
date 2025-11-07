#!/usr/bin/env node

/**
 * Generate favicon assets used by the app build.
 *
 * - favicon.png: 32x32 PNG used as canonical bitmap source
 * - favicon.ico: ICO container (PNG payload) served at /favicon.ico
 *
 * Browsers will request /favicon.ico automatically, so we ensure the
 * generated file is a proper ICO (not just an SVG with a different
 * extension) to keep compatibility with older user agents.
 */

import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const shouldSkip =
  process.env.HDB_SKIP_FAVICON === '1' || process.env.SKIP_FAVICON === '1';

if (shouldSkip) {
  console.log('ℹ️  Skipping favicon generation (HDB_SKIP_FAVICON=1)');
  process.exit(0);
}

const publicDir = join(__dirname, '..', 'public');
const svgPath = join(publicDir, 'favicon.svg');
const pngPath = join(publicDir, 'favicon.png');
const icoPath = join(publicDir, 'favicon.ico');

if (!existsSync(svgPath)) {
  throw new Error(`favicon.svg not found at ${svgPath}`);
}

// Reuse the data URL that is embedded in index.html to keep assets in sync.
const pngBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAA7AAAAOwBeShxvQAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAKhSURBVFiFtZfPaxNBFMc/m91NTNLUVqtQKHgQPIgHL/4DD0LBgxc9ePDkyZMnT548CIIHQfBQLN48ePAgiAcPgiAIgqCIVbGtaWuTJtlkdnZnxkNqsp3Zbhr6hYVh3rz3/bx582ZnBXYhIgJA07R/YmVZRtM0hBBYloUQAtu2kVKiaRpSShzHQdM0HMfBtm2klGiahpQS27axLAtN03Ach2g0iqZpCCGwLIsNm5VSymw2K7PZrJRSSimlzOVyMpfLScdxpOu60nVdKaWUruuGsG1bOo4jHceRtm1Lx3Gk67rSdV3Z6TiO1HVdBvZzXVd2Op12EaqqKl3XbbPneZ7neZ7v+77v+/I/6Ha7XTab3RSPx2N+uBPZto1t2wgh/IsQEYEQIhCXUmJZVgdLKTEMo0MEA8vlcrler9MNq9Vq19pisUi73Q6kjV4ZVFWF4zi+RVRVxXGcTkIIgaqqCCHQNG2TrutYlkU4HEZRFBRF6fQH8TCHhoYAqNfr2LaNoij09PQA0Gq1cByHSCTSMfX392/adyAQGRkZAWBtbY1qtYpt29Trddrt9lZz3yLhcJhyuUy5XKbdbmOaJqZpYprmdsO2xODgIIqiYJomqqqiqiqGYWAYBrquB/K/RTRNo9VqYRgGjuMQjUaJRqOEQiFCoRCKomypOhAIhUIAJBIJEokEAJFIZFs8/1dhGEaIx+MAVCoVADRNIxQKdRJCCCzLwnVdXNft/C4T/7yCaDRKLBajVqtRrVYxTbPz1wPQ29vbh1IjhOhE/v5VFKXrdRAIrF+u6zpCCGzbJhaL0dfXRywWQ1EU4vE4rutSr9exLIsVVVU/ptPp1xsbpFKpL6lU6sv8/Pzi/Pz84vz8fCmVSn0B3mUymeVMJvMGKGUymXKH+wOHEVjLHmWUdAAAAABJRU5ErkJggg==';

const pngBuffer = Buffer.from(pngBase64, 'base64');

const { width, height } = readPngDimensions(pngBuffer);
writeFileSync(pngPath, pngBuffer);

const icoBuffer = createIcoFromPng(pngBuffer, width, height);
writeFileSync(icoPath, icoBuffer);

console.log('✅ Generated favicon assets');
console.log(`   - favicon.png (${width}x${height})`);
console.log('   - favicon.ico (PNG payload inside ICO container)');

function readPngDimensions(buffer) {
  const expectedSignature = 0x89504e47;
  const signature = buffer.readUInt32BE(0);
  if (signature !== expectedSignature) {
    throw new Error('Invalid PNG buffer provided for favicon generation.');
  }

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return { width, height };
}

function createIcoFromPng(pngBuffer, width, height) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // icon type
  header.writeUInt16LE(1, 4); // number of images

  const directory = Buffer.alloc(16);
  directory[0] = width >= 256 ? 0 : width;
  directory[1] = height >= 256 ? 0 : height;
  directory[2] = 0; // color palette size
  directory[3] = 0; // reserved
  directory.writeUInt16LE(1, 4); // color planes
  directory.writeUInt16LE(32, 6); // bit depth
  directory.writeUInt32LE(pngBuffer.length, 8);
  directory.writeUInt32LE(header.length + directory.length, 12);

  return Buffer.concat([header, directory, pngBuffer]);
}
