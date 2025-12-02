/**
 * @file shared/lifecycle-plugin-definition.ts
 * @description BaseMap shared types
 */

export interface MapViewport {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
}

export type BaseMapStylePreset = 'streets' | 'satellite' | 'terrain' | 'dark' | 'light' | 'custom';

export interface BaseMapConfig {
  stylePreset: BaseMapStylePreset;
  styleUrl: string;
  viewport: MapViewport;
}
