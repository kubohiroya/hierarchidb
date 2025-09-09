import type { NodeType } from '@hierarchidb/common-type';

const importerSet = new Set<NodeType>();
const exporterSet = new Set<NodeType>();
let allImportersEnabled = false;
let allExportersEnabled = false;

export function registerImporter(nodeType: NodeType): void {
  importerSet.add(nodeType);
}

export function unregisterImporter(nodeType: NodeType): void {
  importerSet.delete(nodeType);
}

export function canImport(nodeType: NodeType): boolean {
  return allImportersEnabled || importerSet.has(nodeType);
}

export function registerExporter(nodeType: NodeType): void {
  exporterSet.add(nodeType);
}

export function unregisterExporter(nodeType: NodeType): void {
  exporterSet.delete(nodeType);
}

export function canExport(nodeType: NodeType): boolean {
  return allExportersEnabled || exporterSet.has(nodeType);
}

// Enable/disable all
export function enableAllImporters(): void {
  allImportersEnabled = true;
}

export function enableAllExporters(): void {
  allExportersEnabled = true;
}

export function disableImporter(nodeType: NodeType): void {
  importerSet.delete(nodeType);
}

export function disableExporter(nodeType: NodeType): void {
  exporterSet.delete(nodeType);
}
