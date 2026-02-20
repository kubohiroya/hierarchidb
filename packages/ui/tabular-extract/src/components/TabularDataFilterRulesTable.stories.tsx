import type { Meta, StoryObj } from '@storybook/react';
import { Box } from '@mui/material';
import { useState } from 'react';
import type { TabularColumnInfo } from '@hierarchidb/tabular-store';
import type { TabularFilterRule } from '~/types/index';
import { TabularDataFilterRulesTable, type FilterOperatorOption } from './TabularDataFilterRulesTable.js';

const operatorOptions: FilterOperatorOption[] = [
  { value: 'equals', label: 'Equals', types: ['string', 'number', 'date', 'boolean'] },
  { value: 'not_equals', label: 'Not Equals', types: ['string', 'number', 'date', 'boolean'] },
  { value: 'contains', label: 'Contains', types: ['string'] },
  { value: 'not_contains', label: 'Does Not Contain', types: ['string'] },
  { value: 'starts_with', label: 'Starts With', types: ['string'] },
  { value: 'ends_with', label: 'Ends With', types: ['string'] },
  { value: 'greater_than', label: 'Greater Than', types: ['number', 'date'] },
  { value: 'less_than', label: 'Less Than', types: ['number', 'date'] },
  { value: 'greater_equal', label: 'Greater Than or Equal', types: ['number', 'date'] },
  { value: 'less_equal', label: 'Less Than or Equal', types: ['number', 'date'] },
  { value: 'is_null', label: 'Is Empty', types: ['string', 'number', 'date', 'boolean'] },
  { value: 'is_not_null', label: 'Is Not Empty', types: ['string', 'number', 'date', 'boolean'] },
  { value: 'regex', label: 'Regular Expression', types: ['string'] },
];

const columns: TabularColumnInfo[] = [
  { name: 'city', index: 0, type: 'string' },
  { name: 'population', index: 1, type: 'number' },
  { name: 'created_at', index: 2, type: 'date' },
  { name: 'is_capital', index: 3, type: 'boolean' },
];

const meta: Meta<typeof TabularDataFilterRulesTable> = {
  title: 'Tabular/Filter Rules Table',
  component: TabularDataFilterRulesTable,
};

export default meta;

type Story = StoryObj<typeof TabularDataFilterRulesTable>;

export const Playground: Story = {
  render: () => {
    const [rules, setRules] = useState<TabularFilterRule[]>([
      {
        id: '1',
        column: 'city',
        operator: 'contains',
        value: 'York',
        enabled: true,
      },
      {
        id: '2',
        column: 'population',
        operator: 'greater_equal',
        value: 1000000,
        enabled: true,
      },
      {
        id: '3',
        column: 'is_capital',
        operator: 'equals',
        value: 'true',
        enabled: false,
      },
    ]);

    return (
      <Box sx={{ maxWidth: 960, p: 3 }}>
        <TabularDataFilterRulesTable filters={rules} onChange={setRules} columns={columns} operatorOptions={operatorOptions} />
      </Box>
    );
  },
};
