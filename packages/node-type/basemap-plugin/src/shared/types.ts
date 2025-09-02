/**
 * @file shared/lifecycle-types.ts
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

export interface MapDisplayOptions {
  showAttribution: boolean;
  showNavigation: boolean;
  enableInteraction: boolean;
}

export type BaseMapStylePreset = 'streets' | 'satellite' | 'terrain' | 'dark' | 'light' | 'custom';

export interface BaseMapConfig {
  stylePreset: BaseMapStylePreset;
  styleUrl: string;
  viewport: MapViewport;
  displayOptions: MapDisplayOptions;
}
