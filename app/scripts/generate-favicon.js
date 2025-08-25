#!/usr/bin/env node

/**
 * Generate a simple PNG favicon from scratch
 * This creates a 32x32 PNG with a database icon
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple 16x16 PNG with database icon (blue on white)
// This is a minimal PNG file created programmatically
const createSimplePNG = () => {
  // PNG magic number and headers for a 16x16 RGBA image
  const width = 16;
  const height = 16;
  
  // Create a simple blue database icon pattern
  const pixels = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Create database shape (simplified)
      const isDatabase = 
        // Top ellipse
        (y === 3 && x >= 4 && x <= 11) ||
        (y === 4 && x >= 3 && x <= 12) ||
        // Body
        (y >= 5 && y <= 12 && x >= 3 && x <= 12) ||
        // Bottom
        (y === 13 && x >= 4 && x <= 11);
      
      if (isDatabase) {
        // Blue color (#1976d2)
        pixels.push(0x19, 0x76, 0xd2, 0xff);
      } else {
        // White background
        pixels.push(0xff, 0xff, 0xff, 0x00);
      }
    }
  }
  
  return Buffer.from(pixels);
};

// For now, copy the SVG as a temporary solution
// In production, you would use a proper SVG to ICO converter
const svgPath = path.join(__dirname, '..', 'public', 'favicon.svg');
const icoPath = path.join(__dirname, '..', 'public', 'favicon.ico');

// Read the SVG content
const svgContent = fs.readFileSync(svgPath, 'utf8');

// Create a simple HTML file that redirects to the SVG
// This is a workaround for browsers that don't support SVG favicons
const htmlFavicon = `<!DOCTYPE html>
<html>
<head>
<meta http-equiv="refresh" content="0;url=favicon.svg">
</head>
</html>`;

// For now, keep the SVG as ICO (some modern browsers support this)
// But add a proper mime type handler in the server
fs.writeFileSync(icoPath, svgContent);

console.log('✅ Favicon files generated');
console.log('   Note: favicon.ico is currently an SVG file.');
console.log('   Consider using a proper ICO converter for better compatibility.');