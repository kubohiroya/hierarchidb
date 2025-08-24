import { program } from "commander";
import path from "path";
import { fetchMetadata, getAvailableDataSources } from "./index.js";

program
  .name("fetch-metadata")
  .description("Fetch and transform metadata from various open data sources")
  .version("0.0.1");

program
  .command("fetch")
  .description("Fetch metadata from a data source")
  .argument(
    "<source>",
    `Data source name (${getAvailableDataSources().join(", ")})`,
  )
  .argument("<output-dir>", "Output directory path")
  .argument("[output-file]", "Output file name", "metadata.json")
  .action(async (source: string, outputDir: string, outputFile: string) => {
    try {
      console.log(`\n🚀 Starting metadata fetch from ${source}...\n`);

      // Resolve absolute path for output directory
      const absoluteOutputDir = path.resolve(outputDir);

      // Validate data source
      const availableSources = getAvailableDataSources();
      if (!availableSources.includes(source)) {
        console.error(`❌ Error: Unknown data source "${source}"`);
        console.error(`Available sources: ${availableSources.join(", ")}`);
        process.exit(1);
      }

      // Fetch metadata
      await fetchMetadata(source, absoluteOutputDir, outputFile);

      console.log(`\n✨ Successfully fetched metadata from ${source}!`);
      console.log(
        `📁 Output saved to: ${path.join(absoluteOutputDir, outputFile)}\n`,
      );
    } catch (error) {
      console.error(
        "\n❌ Error:",
        error instanceof Error ? error.message : error,
      );
      process.exit(1);
    }
  });

program
  .command("list")
  .description("List available data sources")
  .action(() => {
    console.log("\n📋 Available data sources:\n");
    const sources = getAvailableDataSources();
    sources.forEach((source) => {
      const descriptions: Record<string, string> = {
        gadm: "Global Administrative Areas - High-resolution administrative boundaries",
        naturalearth: "Natural Earth - Free vector and raster map data",
        osm: "OpenStreetMap - Crowd-sourced geographic data",
        geoboundaries: "geoBoundaries - Open administrative boundary data",
      };
      console.log(
        `  • ${source}: ${descriptions[source] || "No description available"}`,
      );
    });
    console.log("");
  });

// Parse command line arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
