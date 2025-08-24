#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const dtsPath = join(process.cwd(), 'dist', 'index.d.ts');

try {
  let content = readFileSync(dtsPath, 'utf8');
  
  // Add type aliases for TourStep and TourCallBackProps
  const typeAliases = '\ntype TourStep = Step;\ntype TourCallBackProps = CallBackProps;\n';
  
  // Insert type aliases before the export statement
  content = content.replace(
    'export { GenericGuidedTour, type GenericGuidedTourProps, GuidedTour, GuidedTourDemo };',
    typeAliases + '\nexport { GenericGuidedTour, type GenericGuidedTourProps, GuidedTour, GuidedTourDemo, type TourStep, type TourCallBackProps };'
  );
  
  writeFileSync(dtsPath, content);
  console.log('Fixed declaration file exports');
} catch (error) {
  console.error('Error fixing declaration file:', error.message);
  process.exit(1);
}