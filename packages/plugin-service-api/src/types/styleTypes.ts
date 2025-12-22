import type { NodeId } from '@hierarchidb/common-types';

export type StyleValueType = 'color' | 'number';

export type StyleType = 'choropleth' | 'points' | 'lines';

export interface StyleKeyValueEntry {
  key: string;
  color?: string;
  scalarValue?: number;
}

export interface StyleDescriptor {
  nodeId: NodeId;
  keyColumn: string;
  valueColumn: string;
  targetProperty: string;
  styleType: StyleType;
  valueType: StyleValueType;
  paintExpression: unknown;
  colorMapping?: Record<string, string>;
  updatedAt: number;
}

export interface StyleKeyValues {
  nodeId: NodeId;
  keyColumn: string;
  valueType: StyleValueType;
  entries: StyleKeyValueEntry[];
}

export interface StyleRecord extends StyleDescriptor {
  keyValues?: StyleKeyValueEntry[];
}
