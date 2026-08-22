import type { Plugin } from 'vite';
import { DEFAULT_COUNTRY_NAMES_I18N_OUTPUT, DEFAULT_OUTPUT } from './csv.js';
import { generateIso3166Files } from './scraper.js';
import type { Iso3166PluginOptions } from './types.js';
export function createIso3166Plugin(options: Iso3166PluginOptions = {}): Plugin {
  let rootDir: string = process.cwd();
  return {
    name: 'iso3166-2-generator',
    apply: 'build',
    configResolved(resolved) {
      rootDir = resolved.root;
    },
    async buildStart() {
      if (options.enabled === false) {
        this.warn?.('iso3166-2 generator disabled (options.enabled === false)');
        return;
      }
      const logger = (msg: string) => (this.warn ? this.warn(msg) : console.warn(msg));
      const { resolve } = await import('node:path');
      const fs = await import('node:fs/promises');
      const outDir = options.outputDir ? resolve(rootDir, options.outputDir) : rootDir;
      const outFile = options.outputFile ?? DEFAULT_OUTPUT;
      const countryNamesI18nOutputFile =
        options.countryNamesI18nOutputFile ?? DEFAULT_COUNTRY_NAMES_I18N_OUTPUT;
      try {
        await fs.access(resolve(outDir, outFile));
        await fs.access(resolve(outDir, countryNamesI18nOutputFile));
        logger(
          `iso3166-2: reuse existing assets at ${resolve(outDir, outFile)} and ${resolve(outDir, countryNamesI18nOutputFile)}`
        );
      } catch {
        await generateIso3166Files({
          ...options,
          outputDir: outDir,
          logger,
        });
      }
    },
  };
}
