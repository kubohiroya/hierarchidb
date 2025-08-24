import fs from 'fs/promises';
import path from 'path';
import type { RegionMetadata } from './types.js';

/**
 * Ensure directory exists, create if not
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    console.error(`Error creating directory ${dirPath}:`, error);
    throw error;
  }
}

/**
 * Save metadata to JSON file
 */
export async function saveMetadata(
  data: RegionMetadata[],
  outputDirName: string,
  outputFileName: string
): Promise<void> {
  const fullPath = path.join(outputDirName, outputFileName);
  
  await ensureDirectory(outputDirName);
  
  try {
    const jsonContent = JSON.stringify(data, null, 2);
    await fs.writeFile(fullPath, jsonContent, 'utf-8');
    console.log(`✅ Saved ${data.length} records to ${fullPath}`);
  } catch (error) {
    console.error(`Error saving metadata to ${fullPath}:`, error);
    throw error;
  }
}

/**
 * Fetch data from URL with retry logic
 */
export async function fetchWithRetry(
  url: string,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<Response> {
  let lastError: Error | undefined;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return response;
    } catch (error) {
      lastError = error as Error;
      console.warn(`Attempt ${i + 1} failed: ${lastError.message}`);
      
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }
  
  throw lastError || new Error('Failed to fetch data');
}