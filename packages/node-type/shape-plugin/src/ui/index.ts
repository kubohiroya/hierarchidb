import type { PluginDialogComponent, PluginPanelComponent } from '@hierarchidb/ui-core';

export async function getDialogComponent(): Promise<PluginDialogComponent> {
  const mod = await import('../components/ShapeDialog.js');
  return (mod as any).ShapeDialog as unknown as PluginDialogComponent;
}

export async function getPanelComponent(): Promise<PluginPanelComponent> {
  const mod = await import('../components/ShapeViewPanel.js');
  return (mod as any).ShapeViewPanel as unknown as PluginPanelComponent;
}

// Register host-composed steps using existing step components (idempotent)
import './steps-provider';
