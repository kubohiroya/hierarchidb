import fs from 'node:fs';
import path from 'node:path';
import diagnostics from 'node:diagnostics_channel';

const logPath = path.resolve(process.cwd(), '.esm-diagnostics.log');
function log(entry) {
  try {
    fs.appendFileSync(logPath, `${entry}\n`);
  } catch (error) {
    console.warn('[esm-diagnostics] write failed', error);
  }
}

const loadChannel = diagnostics.channel('esm:load');
loadChannel.subscribe(({ url, format }) => {
  log(`${new Date().toISOString()} load url=${url} format=${format}`);
});

const resolveChannel = diagnostics.channel('esm:resolve');
resolveChannel.subscribe(({ url, parentURL }) => {
  log(`${new Date().toISOString()} resolve url=${url} parent=${parentURL}`);
});

const translationChannel = diagnostics.channel('esm:translation');
translationChannel.subscribe(({ url }) => {
  log(`${new Date().toISOString()} translation url=${url}`);
});

const importChannel = diagnostics.channel('esm:import');
importChannel.subscribe(({ url, parentURL }) => {
  log(`${new Date().toISOString()} import url=${url} parent=${parentURL}`);
});

export {}
