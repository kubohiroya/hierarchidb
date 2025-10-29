import fs from 'node:fs';
import path from 'node:path';

const logPath = path.resolve(process.cwd(), '.esm-this.log');
let initialized = false;

function ensureInit() {
  if (!initialized) {
    fs.writeFileSync(logPath, `[loader started ${new Date().toISOString()}]\n`);
    initialized = true;
  }
}

export async function load(url, context, defaultLoad) {
  ensureInit();
  try {
    const result = await defaultLoad(url, context);
    if (typeof result.source === 'string') {
      const trimmed = result.source.trim();
      fs.appendFileSync(
        logPath,
        `${new Date().toISOString()} OK url=${url} snippet=${JSON.stringify(trimmed.slice(0, 80))}\n`
      );
      if (trimmed === 'this') {
        fs.appendFileSync(logPath, `${new Date().toISOString()} HIT url=${url}\n`);
      }
    } else {
      fs.appendFileSync(logPath, `${new Date().toISOString()} OK url=${url} (non-string source)\n`);
    }
    return result;
  } catch (error) {
    try {
      const filePath = url.startsWith('file://') ? new URL(url).pathname : null;
      if (filePath && fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        const trimmed = content.trim();
        fs.appendFileSync(
          logPath,
          `${new Date().toISOString()} ERR url=${url} trimmedSample=${JSON.stringify(trimmed.slice(0, 80))}\n`,
        );
      } else {
        fs.appendFileSync(logPath, `${new Date().toISOString()} ERR url=${url} (no-file)\n`);
      }
    } catch (logErr) {
      fs.appendFileSync(logPath, `${new Date().toISOString()} ERR-LOG url=${url} logErr=${logErr.message}\n`);
    }
    throw error;
  }
}
