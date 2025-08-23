/**
 * BaseMapプラグイン - デフォルトビュー
 */
import type { TreeNode } from '@hierarchidb/00-core';
import type { BaseMapEntity } from '../types';

// import { Box, Typography, Paper, List, ListItem, ListItemText, Button } from '@mui/material';
// import { Map, Edit, PreviewStep, Settings } from '@mui/icons-material';

interface RouteParams {
  treeId: string;
  pageNodeId: string;
  targetNodeId: string;
}

interface IndexViewProps {
  node: TreeNode;
  pluginData: BaseMapEntity;
  params: RouteParams;
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
            <strong>Map Style:</strong> streets
          </div>
          <div style={{ marginBottom: '8px' }}>
            <strong>Zoom Level:</strong> 10
          </div>
          <div style={{ marginBottom: '8px' }}>
            <strong>Center:</strong> 0, 0
          </div>
        </div>

        <div style={{ marginTop: '24px', display: 'flex', gap: '8px' }}>
          <a
            href={`/t/${params.treeId}/${params.pageNodeId}/${params.targetNodeId}/basemap/edit`}
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
            href={`/t/${params.treeId}/${params.pageNodeId}/${params.targetNodeId}/basemap/preview`}
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
            href={`/t/${params.treeId}/${params.pageNodeId}/${params.targetNodeId}/basemap/settings`}
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
