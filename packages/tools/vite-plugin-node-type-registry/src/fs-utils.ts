import fs from 'node:fs';
import path from 'node:path';

export function readJsonFile<T>(filePath: string): T | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

export function dirExists(dirPath: string): boolean {
  try {
    return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

export function resolveCandidate(paths: readonly string[]): string | null {
  for (const candidate of paths) {
    if (fileExists(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function toPosixPath(p: string): string {
  return p.split(path.sep).join('/');
}
