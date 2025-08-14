/**
 * BaseMapプラグイン - デフォルトビュー
 */

// import { Box, Typography, Paper, List, ListItem, ListItemText, Button } from '@mui/material';
// import { Map, Edit, Preview, Settings } from '@mui/icons-material';

interface IndexViewProps {
  node: any;
  pluginData: any;
  params: any;
}

export default function IndexView({ node, params }: IndexViewProps) {
  return (
    <div style={{ padding: '24px' }}>
      <div style={{ padding: '24px', border: '1px solid #ccc', borderRadius: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
          <span style={{ marginRight: '16px', fontSize: '40px', color: '#4CAF50' }}>🗺️</span>
          <h1>{node.name}</h1>
        </div>

        <p style={{ color: '#666', marginBottom: '16px' }}>
          BaseMap plugin view for managing map data and tiles.
        </p>

        <div>
          <div style={{ marginBottom: '8px' }}>
            <strong>Map Style:</strong> {node.data?.mapStyle || 'streets'}
          </div>
          <div style={{ marginBottom: '8px' }}>
            <strong>Zoom Level:</strong> {node.data?.zoom || '10'}
          </div>
          <div style={{ marginBottom: '8px' }}>
            <strong>Center:</strong>{' '}
            {`${node.data?.center?.[0] || 0}, ${node.data?.center?.[1] || 0}`}
          </div>
        </div>

        <div style={{ marginTop: '24px', display: 'flex', gap: '8px' }}>
          <a
            href={`/t/${params.treeId}/${params.pageTreeNodeId}/${params.targetTreeNodeId}/basemap/edit`}
            style={{
              padding: '8px 16px',
              backgroundColor: '#1976d2',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '4px',
            }}
          >
            ✏️ Edit Map
          </a>
          <a
            href={`/t/${params.treeId}/${params.pageTreeNodeId}/${params.targetTreeNodeId}/basemap/preview`}
            style={{
              padding: '8px 16px',
              border: '1px solid #1976d2',
              color: '#1976d2',
              textDecoration: 'none',
              borderRadius: '4px',
            }}
          >
            👁️ Preview
          </a>
          <a
            href={`/t/${params.treeId}/${params.pageTreeNodeId}/${params.targetTreeNodeId}/basemap/settings`}
            style={{
              padding: '8px 16px',
              border: '1px solid #1976d2',
              color: '#1976d2',
              textDecoration: 'none',
              borderRadius: '4px',
            }}
          >
            ⚙️ Settings
          </a>
        </div>
      </div>
    </div>
  );
}
