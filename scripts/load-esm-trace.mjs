import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const logPath = path.resolve(process.cwd(), '.node-esm-trace.log');

function append(entry) {
  try {
    fs.appendFileSync(logPath, `${entry}\n`);
  } catch (error) {
    console.warn('[esm-trace-loader] append failed', error);
  }
}

export async function load(url, context, defaultLoad) {
  try {
    const result = await defaultLoad(url, context);
    let info = '';
    if (typeof result.source === 'string') {
      const trimmed = result.source.trim();
      const snippet = trimmed.slice(0, 120).replace(/\s+/g, ' ');
      info = ` snippet=${JSON.stringify(snippet)}`;
      if (trimmed === 'this') {
        info += ' [TRIMMED_THIS]';
      }
    }
    append(`${new Date().toISOString()} OK format=${result.format} url=${url}${info}`);
    return result;
  } catch (error) {
    let snippet = '';
    try {
      const filePath = url.startsWith('file://') ? fileURLToPath(url) : url;
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        snippet = fs.readFileSync(filePath, 'utf-8').slice(0, 120).replace(/\s+/g, ' ');
      }
    } catch {}
    append(`${new Date().toISOString()} ERR url=${url} message=${error?.message ?? ''} snippet=${JSON.stringify(snippet)}`);
    throw error;
  }
}
