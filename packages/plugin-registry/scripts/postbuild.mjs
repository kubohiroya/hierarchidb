import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '..', 'dist');

const rewriteImport = (source, replacements) => {
  let text = source;
  for (const [pattern, replacement] of replacements) {
    text = text.replace(pattern, replacement);
  }
  return text;
};

const jsFiles = readdirSync(distDir).filter((file) => file.endsWith('.js'));
for (const file of jsFiles) {
  const fullPath = path.join(distDir, file);
  const original = readFileSync(fullPath, 'utf-8');
  if (!original.includes('stageWorker.entry.js')) continue;

  const replaced = rewriteImport(original, [
    [/(new Worker\(new URL\(\"\.\/stageWorker\.entry\.js\", import\.meta\.url\), \{ type: \"module\" \}\))/g, "new Worker(new URL('@hierarchidb/runtime-worker-worker/stage-worker', import.meta.url), { type: 'module' })"]
  ]);
  if (original !== replaced) {
    writeFileSync(fullPath, replaced, 'utf-8');
  }
}

const typesPath = path.join(distDir, 'types.d.ts');
try {
  const originalTypes = readFileSync(typesPath, 'utf-8');
  const marker = 'export type { PluginCategoryConfig, PluginDefinition, PluginIconConfig, PluginManifest, PluginRegistryEntry };';
  if (!originalTypes.includes(marker)) {
    const nextTypes = `${originalTypes}\n\n${marker}\n`;
    writeFileSync(typesPath, nextTypes, 'utf-8');
  }
} catch {
  // Ignore missing types output to keep build resilient.
}
