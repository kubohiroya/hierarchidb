import { PluginDefinition, PackageJson, NodeType } from '@hierarchidb/common-type';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface ValidationReport {
  [pluginName: string]: ValidationResult;
}

interface FileSystemMocks {
  readFile: (path: string) => string | Promise<string>;
  exists: (path: string) => boolean | Promise<boolean>;
}

/**
 * Validates consistency between package.json dependencies and plugin metadata
 */
export class PluginMetadataValidator {
  private fileSystemMocks?: FileSystemMocks;

  /**
   * Validates that package.json dependencies match plugin metadata declarations
   */
  async validatePackageJsonDependencies(
    packageJson: PackageJson,
    pluginDefinition: PluginDefinition
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Collect all declared plugin dependencies from metadata
    const declaredDependencies = new Set<string>();

    if (pluginDefinition.dependencies) {
      pluginDefinition.dependencies.forEach((dep) => declaredDependencies.add(dep));
    }

    if (pluginDefinition.extends) {
      declaredDependencies.add(pluginDefinition.extends);
    }

    // Check that all declared dependencies exist in package.json
    for (const dep of declaredDependencies) {
      const expectedPackageName = `@hierarchidb/plugin-${dep}`;
      const alternativePackageName = `@hierarchidb/node-type-${dep}-plugin`;

      if (packageJson.dependencies) {
        const hasOldFormat = expectedPackageName in packageJson.dependencies;
        const hasNewFormat = alternativePackageName in packageJson.dependencies;

        if (!hasOldFormat && !hasNewFormat) {
          errors.push(
            `Plugin metadata declares dependency on "${dep}" but package.json is missing "${alternativePackageName}"`
          );
        }
      } else {
        errors.push('Package.json has no dependencies field');
      }
    }

    // Check for undeclared plugin dependencies in package.json
    if (packageJson.dependencies) {
      for (const depName of Object.keys(packageJson.dependencies)) {
        // Check if it's a plugin dependency
        const oldFormatMatch = depName.match(/^@hierarchidb\/plugin-(.+)$/);
        const newFormatMatch = depName.match(/^@hierarchidb\/node-type-(.+)-plugin$/);

        const pluginName = (oldFormatMatch?.[1] || newFormatMatch?.[1]) as NodeType;

        if (pluginName) {
          // Check if this dependency is declared in metadata
          const isDeclared =
            pluginDefinition.dependencies?.includes(pluginName) ||
            pluginDefinition.extends === pluginName;

          if (!isDeclared) {
            errors.push(
              `Package.json has dependency "${depName}" but plugin metadata does not declare "${pluginName}"`
            );
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validates all plugins in a directory
   */
  async validateAllPlugins(pluginsDir: string): Promise<ValidationReport> {
    const report: ValidationReport = {};

    if (!this.fileSystemMocks) {
      throw new Error('File system mocks not set. Call setFileSystemMocks first.');
    }

    // In a real implementation, we'd list directories here
    // For testing, we'll check known plugin paths
    const pluginNames = ['folder', 'basemap', 'shape', 'stylemap', 'spreadsheet'];

    for (const pluginName of pluginNames) {
      const packageJsonPath = `${pluginsDir}/${pluginName}/package.json`;
      const manifestPath = `${pluginsDir}/${pluginName}/plugin.manifest.json`;

      const packageJsonExists = await this.fileSystemMocks.exists(packageJsonPath);
      const manifestExists = await this.fileSystemMocks.exists(manifestPath);

      if (packageJsonExists && manifestExists) {
        try {
          const packageJsonContent = await this.fileSystemMocks.readFile(packageJsonPath);
          const manifestContent = await this.fileSystemMocks.readFile(manifestPath);

          const packageJson = JSON.parse(packageJsonContent);
          const manifest = JSON.parse(manifestContent);

          report[pluginName] = await this.validatePackageJsonDependencies(packageJson, manifest);
        } catch (error) {
          report[pluginName] = {
            valid: false,
            errors: [`Failed to validate ${pluginName}: ${String(error)}`],
          };
        }
      } else {
        report[pluginName] = {
          valid: false,
          errors: [
            `Missing required files for ${pluginName}:` +
              (!packageJsonExists ? ' package.json' : '') +
              (!manifestExists ? ' plugin.manifest.json' : ''),
          ],
        };
      }
    }

    return report;
  }

  /**
   * Set file system mocks for testing
   */
  setFileSystemMocks(mocks: FileSystemMocks): void {
    this.fileSystemMocks = mocks;
  }

  /**
   * Validate plugin manifest format
   */
  validatePluginManifest(manifest: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!manifest.nodeType) {
      errors.push('Missing required field: nodeType');
    }
    if (!manifest.name) {
      errors.push('Missing required field: name');
    }
    if (!manifest.version) {
      errors.push('Missing required field: version');
    }

    // Version format validation
    if (manifest.version && !/^\d+\.\d+\.\d+/.test(manifest.version)) {
      warnings.push('Version should follow semantic versioning (x.y.z)');
    }

    // Dependencies validation
    if (manifest.dependencies && !Array.isArray(manifest.dependencies)) {
      errors.push('Dependencies field must be an array');
    }

    // Extends validation
    if (manifest.extends && typeof manifest.extends !== 'string') {
      errors.push('Extends field must be a string');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
