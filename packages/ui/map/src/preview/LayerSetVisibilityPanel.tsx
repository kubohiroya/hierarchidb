import {
  Box,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import React from 'react';
import type {
  LayerSetDefinition,
  LayerSetId,
  ResolvedLayerSetEntry,
} from './layerSetDefinitions.js';
import { formatAdminLevelLabel } from './layerSetDefinitions.js';
import { useLayerSetVisibilityPanelView } from './useLayerSetVisibilityPanelView.js';

export type LayerSetVisibility = Record<LayerSetId, boolean>;

export type LayerSetListItem = {
  id: string;
  label: string;
  layerSetId: LayerSetId;
  hierarchyLabel?: string;
  detail?: string;
};

const formatHierarchyLabel = (value?: string | number): string => {
  if (typeof value === 'number' && Number.isFinite(value)) return formatAdminLevelLabel(value);
  if (typeof value === 'string' && value.trim().length > 0) return value;
  return 'Base';
};

export const buildLayerSetListItems = (entries: ResolvedLayerSetEntry[]): LayerSetListItem[] =>
  entries.map((entry) => ({
    id: entry.id,
    label: entry.label,
    layerSetId: entry.layerSetId,
    hierarchyLabel: formatHierarchyLabel(entry.hierarchyLevel),
    detail: entry.sourceLayer,
  }));

export type LayerSetVisibilityPanelProps = {
  layerSets: LayerSetDefinition[];
  visibility: LayerSetVisibility;
  onToggle: (id: LayerSetId) => void;
  items: LayerSetListItem[];
};

export const LayerSetVisibilityPanel: React.FC<LayerSetVisibilityPanelProps> = ({
  layerSets,
  visibility,
  onToggle,
  items,
}) => {
  const { orderedSets, itemsBySet, itemsBySetAndHierarchy } =
    useLayerSetVisibilityPanelView<LayerSetListItem>({
      layerSets,
      items,
    });

  return (
    <Stack spacing={1.5}>
      {orderedSets.map((set) => {
        const visible = visibility[set.id] ?? false;
        const setItems = itemsBySet.get(set.id) ?? [];
        const itemsByHierarchy =
          itemsBySetAndHierarchy.get(set.id) ?? new Map<string, LayerSetListItem[]>();
        return (
          <Box key={set.id}>
            <FormControlLabel
              sx={{ ml: 0 }}
              control={<Switch size="small" checked={visible} onChange={() => onToggle(set.id)} />}
              label={set.label}
            />
            {setItems.length === 0 ? (
              <Typography variant="caption" color="text.secondary">
                No items.
              </Typography>
            ) : (
              <Stack spacing={0.5} sx={{ ml: 2 }}>
                {Array.from(itemsByHierarchy.entries()).map(([hierarchyLabel, groupItems]) => (
                  <Box key={`${set.id}-${hierarchyLabel}`}>
                    <Typography variant="caption" fontWeight={600} display="block">
                      {hierarchyLabel}
                    </Typography>
                    <List dense disablePadding>
                      {groupItems.map((item) => (
                        <ListItem key={item.id} disableGutters>
                          <ListItemText
                            primary={item.label}
                            secondary={item.detail}
                            primaryTypographyProps={{ variant: 'caption' }}
                            secondaryTypographyProps={{
                              variant: 'caption',
                              color: 'text.secondary',
                            }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                ))}
              </Stack>
            )}
          </Box>
        );
      })}
    </Stack>
  );
};
