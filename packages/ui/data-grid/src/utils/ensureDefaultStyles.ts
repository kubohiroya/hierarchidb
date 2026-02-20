import { CrossViewStyles } from '~/CrossViewStyles';

export interface EnsureDefaultStylesOptions {
  includeRow?: boolean;
  includeMap?: boolean;
}

/**
 * Ensure a minimal default style dictionary exists for a dataset channel.
 * Adds 'match' (priority 5), 'hover' (10), 'select' (20) entries.
 * Row styles are light (outline / background), map side uses features-atoms flags.
 */
export function ensureDefaultStyles(datasetId: string, opts: EnsureDefaultStylesOptions = {}) {
  const { includeRow = true, includeMap = true } = opts;
  if (CrossViewStyles.hasStyles(datasetId)) return;
  const styles = new Map<string, any>();
  styles.set('match', {
    priority: 5,
    composeMode: 'merge',
    ...(includeRow ? { row: { sx: { boxShadow: 'inset 3px 0 0 0 #1976d2' } } } : {}),
    ...(includeMap ? { map: { lineColor: [0, 0, 0, 200] } } : {}),
  });
  styles.set('hover', {
    priority: 10,
    composeMode: 'merge',
    ...(includeRow ? { row: { sx: { outline: '2px solid #1976d2' } } } : {}),
    ...(includeMap ? { map: { featureState: { hovered: true } } } : {}),
  });
  styles.set('select', {
    priority: 20,
    composeMode: 'merge',
    ...(includeRow ? { row: { sx: { backgroundColor: '#e3f2fd' } } } : {}),
    ...(includeMap ? { map: { featureState: { selected: true } } } : {}),
  });
  CrossViewStyles.setStyles(datasetId, styles);
}

