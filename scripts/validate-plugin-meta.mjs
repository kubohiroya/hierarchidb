import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';

const repoRoot = path.resolve(process.cwd());
const schemaPath = path.join(repoRoot, 'tools/schemas/hierarchidb.plugin.schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));

const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

const pluginDirs = fs.readdirSync(path.join(repoRoot, 'packages/node-type'))
  .filter((d) => fs.existsSync(path.join(repoRoot, 'packages/node-type', d, 'package.json')));

let ok = true;
for (const d of pluginDirs) {
  const pkgPath = path.join(repoRoot, 'packages/node-type', d, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const meta = pkg?.hierarchidb?.plugin;
  if (!meta) {
    console.error(`[validate-plugin-meta] Missing hierarchidb.plugin: ${d}/package.json`);
    ok = false;
    continue;
  }
  const valid = validate(meta);
  if (!valid) {
    console.error(`\n[validate-plugin-meta] Schema errors in ${d}/package.json:`);
    for (const e of validate.errors || []) {
      console.error(`  - ${e.instancePath || '(root)'} ${e.message}`);
    }
    ok = false;
  } else {
    console.log(`[validate-plugin-meta] OK: ${d} (${meta.nodeType})`);
  }
}

if (!ok) {
  process.exit(1);
}

