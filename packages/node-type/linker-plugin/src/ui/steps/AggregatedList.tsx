import React, { useEffect, useMemo, useState } from 'react';
import { Box, List, ListItem, ListItemText, Typography } from '@mui/material';
import type { ResourceSummary } from './ResourcePicker';
import type { NodeId, TreeNode } from '@hierarchidb/common-type';
import type WorkerAPI from '@hierarchidb/common-api/src/WorkerAPI';
import { getWorkerClientHook } from '@hierarchidb/runtime-worker-bootstrap';
import type { TreeQueryAPI } from '@hierarchidb/common-api';

export interface AggregatedListProps {
  selfNodeId?: NodeId; // Linker node (edit時)
  selected: ResourceSummary[];   // Step2で選択した集合
}

type LinkerNode = TreeNode & { data?: { likedNodeIdSet?: string[] | Set<string> } };

type WorkerClientRef = { client?: WorkerAPI } | WorkerAPI | null;
function resolveWorkerClient(): WorkerAPI | null {
  const hook = getWorkerClientHook<WorkerClientRef>() || null;
  const ref = hook ? hook() : null;
  if (!ref) return null;
  return (typeof (ref as any).getQueryAPI === 'function')
    ? (ref as WorkerAPI)
    : (((ref as { client?: WorkerAPI }).client) || null);
}

export const AggregatedList: React.FC<AggregatedListProps> = ({ selfNodeId, selected }) => {
  const [items, setItems] = useState<ResourceSummary[]>([]);
  const client = resolveWorkerClient();

  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        const base = new Map<string, ResourceSummary>();
        // 自身の選択
        for (const s of selected) base.set(s.nodeId, s);

        if (client && selfNodeId) {
          const query: TreeQueryAPI = await client.getQueryAPI();
          // 現行APIへ置換: listAncestors/listDescendants を使用し、nodeType でフィルタ
          const ancestorsAll = (await query.listAncestors(selfNodeId)) as TreeNode[];
          const descendantsAll = (await query.listDescendants(selfNodeId)) as TreeNode[];
          const linkerAnc = (ancestorsAll || []).filter((n) => n?.nodeType === 'linker');
          const linkerDesc = (descendantsAll || []).filter((n) => n?.nodeType === 'linker');

          // 他 Linker ノードの likedNodeIdSet を統合（TreeNode.data 経由）
          const collectFrom = async (nodes: LinkerNode[]) => {
            for (const ln of nodes) {
              try {
                const t = (await query.getNode(ln.id)) as unknown as LinkerNode | undefined;
                const liked = t?.data?.likedNodeIdSet;
                const arr = Array.isArray(liked) ? liked : (liked instanceof Set ? Array.from(liked) : []);
                for (const id of arr) {
                  const s: ResourceSummary = { nodeId: String(id) };
                  base.set(s.nodeId, s);
                }
              } catch { /* noop */ }
            }
          };
          await collectFrom(linkerAnc);
          await collectFrom(linkerDesc);
        }
        if (!disposed) setItems(Array.from(base.values()).sort((a,b)=> (a.name||a.nodeId).localeCompare(b.name||b.nodeId)));
      } catch {
        if (!disposed) setItems(selected);
      }
    })();
    return () => { disposed = true; };
  }, [client, selfNodeId, selected]);

  const count = useMemo(() => items.length, [items]);

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Aggregated resources from ancestors/self/descendants ({count} items)
      </Typography>
      <List dense>
        {items.map((it) => (
          <ListItem key={it.nodeId}>
            <ListItemText primary={it.name || it.nodeId} secondary={it.nodeType} />
          </ListItem>
        ))}
      </List>
    </Box>
  );
};
