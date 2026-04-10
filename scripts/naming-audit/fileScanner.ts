// ============================================================
// FileScanner -- walks the file system and collects FileEntry[].
//
// Resolves glob patterns in targetDirs (e.g. "packages/*/src/")
// and returns one FileEntry per .ts / .tsx file found, excluding
// dist/, *.d.ts, and __tests__/ by default.
// ============================================================

import fs from 'node:fs';
import path from 'node:path';

import type { FileEntry, FileScannerOptions } from './types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a single target-dir pattern (which may contain `*` wildcards)
 * into concrete directory paths that exist on disk.
 */
function resolveTargetDirs(pattern: string): string[] {
    const normalized = pattern.replace(/\/+$/, '');

    if (!normalized.includes('*')) {
        const abs = path.resolve(normalized);
        return fs.existsSync(abs) ? [abs] : [];
    }

    const segments = normalized.split('/');
    const wildcardIdx = segments.findIndex((s) => s.includes('*'));

    const baseDir = path.resolve(segments.slice(0, wildcardIdx).join('/'));
    if (!fs.existsSync(baseDir)) return [];

    const wildcardSegment = segments[wildcardIdx];
    const rest = segments.slice(wildcardIdx + 1).join('/');

    // Convert the wildcard segment into a simple regex.
    const escaped = wildcardSegment.replace(/[.+?^{}()|[\]\\]/g, '\\$&');
    const regexStr = '^' + escaped.replace(/\*/g, '[^/]+') + '$';
    const regex = new RegExp(regexStr);

    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    const matched: string[] = [];

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (!regex.test(entry.name)) continue;

        const candidate = rest
            ? path.join(baseDir, entry.name, rest)
            : path.join(baseDir, entry.name);

        if (fs.existsSync(candidate)) {
            matched.push(candidate);
        }
    }

    return matched;
}

/**
 * Derive the sub-package identifier from a resolved directory path.
 *
 * Heuristic (in order):
 *   plugins/name/src  -> "name"   (e.g. "shape-plugin")
 *   packages/name/src -> "name"   (e.g. "core-types")
 *   app/src           -> "app"
 *   fallback          -> last meaningful segment
 */
function deriveSubPackage(resolvedDir: string): string {
    const rel = path.relative(process.cwd(), resolvedDir).replace(/\\/g, '/');
    const parts = rel.split('/');

    // plugins/<name>/src or packages/<name>/src
    if (
        parts.length >= 3 &&
        (parts[0] === 'plugins' || parts[0] === 'packages') &&
        parts[parts.length - 1] === 'src'
    ) {
        return parts[1];
    }

    // app/src
    if (parts.length >= 2 && parts[0] === 'app' && parts[1] === 'src') {
        return 'app';
    }

    // Fallback: use the parent of "src" if present, otherwise the last segment.
    const srcIdx = parts.lastIndexOf('src');
    if (srcIdx > 0) return parts[srcIdx - 1];
    return parts[parts.length - 1] || 'unknown';
}

/**
 * Check whether a file path should be excluded based on the exclude patterns.
 *
 * Supported pattern styles:
 *   "dist/"      -> exclude any path segment named "dist"
 *   "*.d.ts"     -> exclude files ending with ".d.ts"
 *   "__tests__/" -> exclude any path segment named "__tests__"
 */
function isExcluded(
    relativePath: string,
    excludePatterns: readonly string[],
): boolean {
    for (const pattern of excludePatterns) {
        // Directory-style pattern (e.g. "dist/", "__tests__/")
        if (pattern.endsWith('/')) {
            const dirName = pattern.slice(0, -1);
            const segments = relativePath.split('/');
            if (segments.some((s) => s === dirName)) return true;
            continue;
        }

        // Wildcard extension pattern (e.g. "*.d.ts")
        if (pattern.startsWith('*.')) {
            const suffix = pattern.slice(1); // ".d.ts"
            if (relativePath.endsWith(suffix)) return true;
            continue;
        }

        // Exact match fallback
        if (relativePath.includes(pattern)) return true;
    }

    return false;
}

/**
 * Recursively collect all .ts / .tsx files under `dir`.
 */
function walkDir(dir: string): string[] {
    const results: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            results.push(...walkDir(fullPath));
        } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (ext === '.ts' || ext === '.tsx') {
                results.push(fullPath);
            }
        }
    }

    return results;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Scan the file system for .ts / .tsx files matching the given options.
 *
 * @param options - target directories (may contain globs) and exclude patterns
 * @returns an array of FileEntry objects
 */
export function scanFiles(options: FileScannerOptions): FileEntry[] {
    const { targetDirs, excludePatterns } = options;
    const entries: FileEntry[] = [];

    for (const targetDir of targetDirs) {
        const resolvedDirs = resolveTargetDirs(targetDir);

        for (const resolvedDir of resolvedDirs) {
            const subPackage = deriveSubPackage(resolvedDir);
            const allFiles = walkDir(resolvedDir);

            for (const absPath of allFiles) {
                const relPath = path
                    .relative(resolvedDir, absPath)
                    .replace(/\\/g, '/');

                if (isExcluded(relPath, excludePatterns)) continue;

                const ext = path.extname(absPath);
                if (ext !== '.ts' && ext !== '.tsx') continue;

                entries.push({
                    absolutePath: absPath,
                    relativePath: relPath,
                    subPackage,
                    extension: ext as '.ts' | '.tsx',
                });
            }
        }
    }

    return entries;
}
