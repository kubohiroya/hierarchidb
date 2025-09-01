import type { Meta, StoryObj } from '@storybook/react';
import { Provider } from 'jotai';
import { SearchResultTable } from '../components/SearchResultTable.js';
import type { SearchResult } from '../types/index.js';
import type { NodeId } from '@hierarchidb/common-type';

const meta: Meta<typeof SearchResultTable> = {
  title: 'SearchResult/SearchResultTable',
  component: SearchResultTable,
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (Story) => (
      <Provider>
        <div style={{ height: '600px', width: '100%' }}>
          <Story />
        </div>
      </Provider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

// モックデータ
const mockResults: SearchResult[] = [
  {
    nodeId: 'node-1' as NodeId,
    nodeName: 'Tokyo Station',
    nodeType: 'location',
    matchedProperty: 'name',
    matchedValue: 'Tokyo Station',
    confidence: 0.95,
    parentPath: ['Japan', 'Tokyo'],
    stylerNodeId: 'style-node-1' as NodeId,
    stylerNodeName: 'Central Tokyo',
    rowIndex: 0,
    rowData: {
      name: 'Tokyo Station',
      type: 'Railway Station',
      prefecture: 'Tokyo',
      established: '1914',
    },
    displayColumns: ['name', 'type', 'prefecture'],
  },
  {
    nodeId: 'node-2' as NodeId,
    nodeName: 'Shibuya Crossing',
    nodeType: 'landmark',
    matchedProperty: 'description',
    matchedValue: 'famous intersection',
    confidence: 0.87,
    parentPath: ['Japan', 'Tokyo', 'Shibuya'],
    stylerNodeId: 'style-node-2' as NodeId,
    stylerNodeName: 'Shibuya District',
    rowIndex: 5,
    rowData: {
      name: 'Shibuya Crossing',
      type: 'Intersection',
      visitors: '3000000/day',
      famous: true,
    },
    displayColumns: ['name', 'type', 'visitors'],
  },
  {
    nodeId: 'node-3' as NodeId,
    nodeName: 'Mount Fuji',
    nodeType: 'mountain',
    matchedProperty: 'elevation',
    matchedValue: '3776',
    confidence: 0.92,
    parentPath: ['Japan', 'Shizuoka'],
    stylerNodeId: 'style-node-3' as NodeId,
    stylerNodeName: 'Fuji Area',
    rowIndex: 12,
    rowData: {
      name: 'Mount Fuji',
      elevation: '3776m',
      type: 'Volcano',
      status: 'Active',
      lastEruption: '1708',
    },
    displayColumns: ['name', 'elevation', 'type'],
  },
  {
    nodeId: 'node-4' as NodeId,
    nodeName: 'Osaka Castle',
    nodeType: 'castle',
    matchedProperty: 'built',
    matchedValue: '1583',
    confidence: 0.79,
    parentPath: ['Japan', 'Osaka'],
    stylerNodeId: 'style-node-4' as NodeId,
    stylerNodeName: 'Osaka Central',
    rowIndex: 3,
    rowData: {
      name: 'Osaka Castle',
      built: '1583',
      type: 'Castle',
      height: '58m',
      floors: '8',
    },
    displayColumns: ['name', 'built', 'type'],
  },
  {
    nodeId: 'node-5' as NodeId,
    nodeName: 'Fushimi Inari Shrine',
    nodeType: 'shrine',
    matchedProperty: 'gates',
    matchedValue: 'thousands of torii gates',
    confidence: 0.88,
    parentPath: ['Japan', 'Kyoto', 'Fushimi'],
    rowIndex: 7,
    rowData: {
      name: 'Fushimi Inari Shrine',
      gates: '10000+',
      deity: 'Inari',
      founded: '711',
    },
    displayColumns: ['name', 'gates', 'deity'],
  },
];

export const Default: Story = {
  args: {
    results: mockResults,
    selectedResults: new Set(),
    onResultSelect: (result: SearchResult, isMultiSelect: boolean) => {
      console.log('Selected:', result.nodeName, 'Multi:', isMultiSelect);
    },
    onMapFocus: (result: SearchResult) => {
      console.log('Focus on map:', result.nodeName);
    },
  },
};

export const WithSelection: Story = {
  args: {
    results: mockResults,
    selectedResults: new Set(['node-1', 'node-3'] as NodeId[]),
    onResultSelect: (result: SearchResult, isMultiSelect: boolean) => {
      console.log('Selected:', result.nodeName, 'Multi:', isMultiSelect);
    },
    onMapFocus: (result: SearchResult) => {
      console.log('Focus on map:', result.nodeName);
    },
  },
};

export const EmptyResults: Story = {
  args: {
    results: [],
    selectedResults: new Set(),
    onResultSelect: (result: SearchResult, isMultiSelect: boolean) => {
      console.log('Selected:', result.nodeName, 'Multi:', isMultiSelect);
    },
    onMapFocus: (result: SearchResult) => {
      console.log('Focus on map:', result.nodeName);
    },
  },
};

export const LargeDataset: Story = {
  args: {
    results: Array.from({ length: 50 }, (_, i) => ({
      nodeId: `node-${i + 1}` as NodeId,
      nodeName: `Location ${i + 1}`,
      nodeType: 'location',
      matchedProperty: 'name',
      matchedValue: `Location ${i + 1}`,
      confidence: Math.random() * 0.4 + 0.6, // 0.6-1.0の範囲
      parentPath: ['Japan', 'Prefecture', 'City'],
      stylerNodeId: `style-node-${i + 1}` as NodeId,
      stylerNodeName: `Style Map ${i + 1}`,
      rowIndex: i,
      rowData: {
        name: `Location ${i + 1}`,
        type: ['Station', 'Park', 'Building', 'Shop'][i % 4],
        code: `LOC${String(i + 1).padStart(3, '0')}`,
        category: ['A', 'B', 'C'][i % 3],
      },
      displayColumns: ['name', 'type', 'code'],
    })),
    selectedResults: new Set(),
    onResultSelect: (result: SearchResult, isMultiSelect: boolean) => {
      console.log('Selected:', result.nodeName, 'Multi:', isMultiSelect);
    },
    onMapFocus: (result: SearchResult) => {
      console.log('Focus on map:', result.nodeName);
    },
  },
};