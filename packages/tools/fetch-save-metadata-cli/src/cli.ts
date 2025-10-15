import { argv, exit } from 'node:process';
import { Command } from 'commander';
import { fetchAndSaveMetadata } from '@hierarchidb/fetch-save-metadata';

const program = new Command()
  .name('fetch-save-metadata')
  .description('Fetch and transform metadata from various open data sources')
  .version('0.0.1');

program
  .command('fetch')
  .description('Fetch and save metadata from a data source')
  .argument('<sourceURL>', `Data source name (${getAvailableDataSources().join(', ')})`)
  .argument('<output-dir>', 'Output directory path')
  .argument('[output-file]', 'Output file name', 'metadata.json')
  .action(async (sourceURL: string, outputDirName: string, outputFileName: string) => {
    try {
      console.log(`\n🚀 Starting metadata fetch from ${sourceURL}...\n`);
      // Fetch metadata
      await fetchAndSaveMetadata({sourceURL, outputDirName, outputFileName});
    } catch (error) {
      console.error('\n❌ Error:', error instanceof Error ? error.message : error);
      exit(1);
    }
  });

program
  .command('list')
  .description('List available data sources')
  .action(() => {
    console.log('\n📋 Available data sources:\n');
  });

// Parse command line arguments
program.parse(argv);

// Show help if no command provided
if (!argv.slice(2).length) {
  program.outputHelp();
}
