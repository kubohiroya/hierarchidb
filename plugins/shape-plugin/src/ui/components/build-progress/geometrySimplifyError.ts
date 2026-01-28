export type GeometrySimplifyErrorDetails = {
  stage?: string;
  reason?: string;
  invalidFeatures?: string;
  invalidPolygons?: string;
  missingGeometry?: string;
  invalidGeometries?: string;
  invalidRings?: string;
  openRings?: string;
  emptyRings?: string;
  nonFiniteCoords?: string;
  minRingVertices?: string;
  selfIntersections?: string;
  degenerateRings?: string;
  duplicateVertices?: string;
  minRingArea?: string;
  maxRingArea?: string;
  maxRingVertices?: string;
  avgRingVertices?: string;
  samples?: string;
};

const stripParens = (text: string): string => text.replace(/^\(|\)$/g, '');

const parseKeyValueBlock = (text: string): Record<string, string> => {
  const result: Record<string, string> = {};
  const entries = text.split(',').map((entry) => entry.trim());
  entries.forEach((entry) => {
    const [key, value] = entry.split('=').map((token) => token.trim());
    if (!key || !value) return;
    result[key] = value;
  });
  return result;
};

export const parseGeometrySimplifyError = (message?: string | null): GeometrySimplifyErrorDetails | null => {
  if (!message || !message.includes('geometry simplify error')) return null;
  const blocks = message.match(/\([^)]*\)/g) ?? [];
  const details: GeometrySimplifyErrorDetails = {};
  blocks.forEach((block) => {
    const content = stripParens(block);
    if (!content) return;
    if (content.startsWith('extract')) {
      details.stage = content;
      return;
    }
    if (content === 'invalid polygon' || content === 'simplified features empty') {
      details.reason = content;
      return;
    }
    if (content.startsWith('invalidFeatures=')) {
      const values = parseKeyValueBlock(content);
      details.invalidFeatures = values.invalidFeatures;
      details.invalidPolygons = values.invalidPolygons;
      details.missingGeometry = values.missingGeometry;
      details.invalidGeometries = values.invalidGeometries;
      return;
    }
    if (content.startsWith('invalidRings=')) {
      const values = parseKeyValueBlock(content);
      details.invalidRings = values.invalidRings;
      details.openRings = values.openRings;
      details.emptyRings = values.emptyRings;
      details.nonFiniteCoords = values.nonFiniteCoords;
      details.minRingVertices = values.minRingVertices;
      return;
    }
    if (content.startsWith('selfIntersections=')) {
      const values = parseKeyValueBlock(content);
      details.selfIntersections = values.selfIntersections;
      details.degenerateRings = values.degenerateRings;
      details.duplicateVertices = values.duplicateVertices;
      details.minRingArea = values.minRingArea;
      details.maxRingArea = values.maxRingArea;
      details.maxRingVertices = values.maxRingVertices;
      details.avgRingVertices = values.avgRingVertices;
      return;
    }
    if (content.startsWith('samples=')) {
      details.samples = content;
    }
  });
  return details;
};

export const formatGeometrySimplifySummary = (details: GeometrySimplifyErrorDetails): string[] => {
  const lines: string[] = [];
  if (details.stage || details.reason) {
    const summaryParts = [details.stage, details.reason].filter(Boolean);
    lines.push(summaryParts.join(' | '));
  }
  const geometryParts = [
    details.invalidFeatures ? `invalidFeatures=${details.invalidFeatures}` : null,
    details.invalidPolygons ? `invalidPolygons=${details.invalidPolygons}` : null,
    details.missingGeometry ? `missingGeometry=${details.missingGeometry}` : null,
    details.invalidGeometries ? `invalidGeometries=${details.invalidGeometries}` : null,
  ].filter(Boolean);
  if (geometryParts.length > 0) {
    lines.push(geometryParts.join(' '));
  }
  const ringParts = [
    details.invalidRings ? `invalidRings=${details.invalidRings}` : null,
    details.openRings ? `openRings=${details.openRings}` : null,
    details.emptyRings ? `emptyRings=${details.emptyRings}` : null,
    details.nonFiniteCoords ? `nonFiniteCoords=${details.nonFiniteCoords}` : null,
    details.minRingVertices ? `minRingVertices=${details.minRingVertices}` : null,
  ].filter(Boolean);
  if (ringParts.length > 0) {
    lines.push(ringParts.join(' '));
  }
  const geometryStatsParts = [
    details.selfIntersections ? `selfIntersections=${details.selfIntersections}` : null,
    details.degenerateRings ? `degenerateRings=${details.degenerateRings}` : null,
    details.duplicateVertices ? `duplicateVertices=${details.duplicateVertices}` : null,
  ].filter(Boolean);
  if (geometryStatsParts.length > 0) {
    lines.push(geometryStatsParts.join(' '));
  }
  const ringAreaParts = [
    details.minRingArea ? `minRingArea=${details.minRingArea}` : null,
    details.maxRingArea ? `maxRingArea=${details.maxRingArea}` : null,
    details.maxRingVertices ? `maxRingVertices=${details.maxRingVertices}` : null,
    details.avgRingVertices ? `avgRingVertices=${details.avgRingVertices}` : null,
  ].filter(Boolean);
  if (ringAreaParts.length > 0) {
    lines.push(ringAreaParts.join(' '));
  }
  if (details.samples) {
    lines.push(details.samples);
  }
  return lines;
};
