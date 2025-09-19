import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Divider, List, ListItem, ListItemText, Stack, Typography } from '@mui/material';
import { listTiles, getTile, getTileSummary } from '../../services/tiles/RuntimeTileClient.js';

export function TilePreview({ sessionId }: { sessionId: string }) {
  const [tiles, setTiles] = useState<Array<{ z: number; x: number; y: number; size: number; timestamp: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ tiles: number; totalBytes: number; zoomMin?: number; zoomMax?: number } | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setLoading(true);
        const [t, s] = await Promise.all([listTiles(sessionId), getTileSummary(sessionId)]);
        if (!cancel) {
          setTiles(t);
          setSummary(s);
        }
      } catch (e: any) {
        if (!cancel) setError(e?.message || 'Failed to load tiles');
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [sessionId]);

  const humanTotal = useMemo(() => {
    const bytes = summary?.totalBytes || 0;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }, [summary?.totalBytes]);

  const handleDownload = async (z: number, x: number, y: number) => {
    try {
      const bytes = await getTile(sessionId, z, x, y);
      if (!bytes) return;
      const blob = new Blob([bytes], { type: 'application/vnd.mapbox-vector-tile' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tile-${sessionId}-${z}-${x}-${y}.mvt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      // ignore
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="h6">Vector Tiles</Typography>
        {summary && (
          <Typography variant="body2" color="text.secondary">
            {summary.tiles} tiles, {humanTotal} (z{summary.zoomMin}-{summary.zoomMax})
          </Typography>
        )}
      </Stack>
      <Divider sx={{ mb: 1 }} />
      {loading && <Typography variant="body2">Loading…</Typography>}
      {error && <Typography variant="body2" color="error">{error}</Typography>}
      {!loading && !error && (
        <List dense sx={{ maxHeight: 320, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          {tiles.map((t) => (
            <ListItem key={`${t.z}-${t.x}-${t.y}`} secondaryAction={<Button size="small" onClick={() => handleDownload(t.z, t.x, t.y)}>Download</Button>}>
              <ListItemText primary={`z${t.z}/${t.x}/${t.y}`} secondary={`${(t.size / 1024).toFixed(1)} KB • ${new Date(t.timestamp).toLocaleString()}`} />
            </ListItem>
          ))}
          {tiles.length === 0 && <ListItem><ListItemText primary="No tiles generated yet." /></ListItem>}
        </List>
      )}
    </Box>
  );
}
