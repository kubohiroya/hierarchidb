import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';
import { loadPluginManifestFromFile } from '../tools/plugin-manifest-loader.js';

const repoRoot = path.resolve(process.cwd());
const schemaPath = path.join(repoRoot, 'tools/schemas/plugin-manifest.schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));

const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

const pluginDirs = fs.readdirSync(path.join(repoRoot, 'packages/plugin-loader'))
  .filter((d) => fs.existsSync(path.join(repoRoot, 'packages/plugin-loader', d, 'src', 'extension', 'plugin-manifest.ts')));

let ok = true;
for (const d of pluginDirs) {
  const manifestPath = path.join(repoRoot, 'packages/plugin-loader', d, 'src', 'extension', 'plugin-manifest.ts');
  const manifest = loadPluginManifestFromFile(manifestPath, { silent: true });
  if (!manifest) {
    console.error(`[validate-plugin-meta] Missing plugin manifest: ${manifestPath}`);
    ok = false;
    continue;
  }
  const valid = validate(manifest);
  if (!valid) {
    console.error(`\n[validate-plugin-meta] Schema errors in ${manifestPath}:`);
    for (const e of validate.errors || []) {
      console.error(`  - ${e.instancePath || '(root)'} ${e.message}`);
    }
    ok = false;
  } else {
    console.log(`[validate-plugin-meta] OK: ${d} (${manifest.nodeType})`);
  }
}

if (!ok) {
  process.exit(1);
}
