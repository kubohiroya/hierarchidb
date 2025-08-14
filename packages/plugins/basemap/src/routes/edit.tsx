/**
 * BaseMapプラグイン - 編集ビュー
 */
import { useState, ChangeEvent } from 'react';
// import { Box, Paper, Typography, TextField, Select, MenuItem, FormControl, InputLabel, Button, Grid } from '@mui/material';
// import { Save, Cancel } from '@mui/icons-material';

interface EditViewProps {
  node: any;
  pluginData: any;
  params: any;
}

export default function EditView({ node, params }: EditViewProps) {
  const [mapData, setMapData] = useState({
    name: node.name,
    mapStyle: node.data?.mapStyle || 'streets',
    center: {
      lat: node.data?.center?.[1] || 0,
      lng: node.data?.center?.[0] || 0,
    },
    zoom: node.data?.zoom || 10,
    bearing: node.data?.bearing || 0,
    pitch: node.data?.pitch || 0,
  });

  const handleSave = async () => {
    // TODO: Worker APIを通じて保存
    console.log('Saving map data:', mapData);
  };

  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ marginBottom: '16px' }}>Edit BaseMap: {node.name}</h1>

      <div
        style={{
          padding: '24px',
          border: '1px solid #ccc',
          borderRadius: '8px',
          marginTop: '16px',
        }}
      >
        <div style={{ display: 'grid', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              Map Name
            </label>
            <input
              type="text"
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '4px',
              }}
              value={mapData.name}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setMapData({ ...mapData, name: e.target.value })
              }
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Map Style
              </label>
              <select
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                }}
                value={mapData.mapStyle}
                onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                  setMapData({ ...mapData, mapStyle: e.target.value })
                }
              >
                <option value="streets">Streets</option>
                <option value="satellite">Satellite</option>
                <option value="hybrid">Hybrid</option>
                <option value="terrain">Terrain</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Zoom Level
              </label>
              <input
                type="number"
                min="1"
                max="20"
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                }}
                value={mapData.zoom}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setMapData({ ...mapData, zoom: parseInt(e.target.value) })
                }
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Center Latitude
              </label>
              <input
                type="number"
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                }}
                value={mapData.center.lat}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setMapData({
                    ...mapData,
                    center: { ...mapData.center, lat: parseFloat(e.target.value) },
                  })
                }
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Center Longitude
              </label>
              <input
                type="number"
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                }}
                value={mapData.center.lng}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setMapData({
                    ...mapData,
                    center: { ...mapData.center, lng: parseFloat(e.target.value) },
                  })
                }
              />
            </div>
          </div>
        </div>

        <div style={{ marginTop: '24px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <a
            href={`/t/${params.treeId}/${params.pageTreeNodeId}/${params.targetTreeNodeId}`}
            style={{
              padding: '8px 16px',
              border: '1px solid #ccc',
              color: '#666',
              textDecoration: 'none',
              borderRadius: '4px',
            }}
          >
            ❌ Cancel
          </a>
          <button
            style={{
              padding: '8px 16px',
              backgroundColor: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
            onClick={handleSave}
          >
            💾 Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
