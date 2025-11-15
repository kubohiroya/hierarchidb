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

export interface MapStyle {
  id: string;
  name: string;
  url: string;
  attribution?: string;
  preview?: string;
}

export type BaseMapStylePreset = 'streets' | 'satellite' | 'terrain' | 'dark' | 'light' | 'custom';

export interface BaseMapConfig {
  stylePreset: BaseMapStylePreset;
  styleUrl: string;
  viewport: MapViewport;
}
