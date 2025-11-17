import { promises as fs } from 'fs';
import * as path from 'path';
import type { DataSourceFetcher } from './utils/dataSourceFetcher.js';
import { fetchWithRetry } from './utils/fetchWithRetry.js';

/**
 * Save metadata to JSON file
 */
export async function fetchAndSaveMetadata({
  sourceURL,
  outputDirName,
  outputFileName,
}: DataSourceFetcher): Promise<void> {
  //const  = dataSourceFetcher;
  const fullPath = path.join(outputDirName, outputFileName);

  async function fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Ensure directory exists, create if not
   */
  async function ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      console.error(`Error creating directory ${dirPath}:`, error);
      throw error;
    }
  }

  if (await fileExists(fullPath)) {
    console.log(`[fetch-save-metadata] ${outputFileName} already exists – skipping download.`);
    return;
  }

  await ensureDirectory(outputDirName);
  const json = (await (await fetchWithRetry(sourceURL)).json()) as string;
  try {
    const jsonContent = JSON.stringify(json, null, 2);
    await fs.writeFile(fullPath, jsonContent, 'utf-8');
    console.log(`✅ Saved ${json.length} records to ${fullPath}`);
  } catch (error) {
    console.error(`Error saving metadata to ${fullPath}:`, error);
    throw error;
  }
}
