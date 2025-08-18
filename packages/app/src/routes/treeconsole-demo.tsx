/**
 * TreeConsole Demo Page
 * 
 * TreeConsoleパッケージの統合テストページ
 * WorkerAPIClientと接続してTreeConsoleコンポーネントの動作を確認
 */

import { useState, useEffect } from 'react';
import { Box, Container, Typography, Alert, CircularProgress } from '@mui/material';
import { TreeTableConsolePanelContext, WorkerAPIAdapter } from '@hierarchidb/ui-treeconsole';
import { WorkerAPIClient } from '@hierarchidb/ui-client';
import type { TreeNodeId, Tree } from '@hierarchidb/core';

export default function TreeConsoleDemo() {
  const [client, setClient] = useState<WorkerAPIClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [defaultTree, setDefaultTree] = useState<Tree | null>(null);

  // WorkerAPIClientの初期化
  useEffect(() => {
    async function initClient() {
      try {
        setLoading(true);
        const workerClient = await WorkerAPIClient.getSingleton();
        setClient(workerClient);
        
        // デフォルトツリーを取得または作成
        const api = workerClient.getAPI();
        const trees = await api.getTrees();
        
        let tree: Tree | null = null;
        if (trees && trees.length > 0) {
          // 既存のツリーがある場合は最初のものを使用
          tree = trees[0];
        } else {
          // ツリーがない場合は新規作成
          tree = await api.createTree({
            name: 'Demo Tree',
            description: 'TreeConsole Demo Tree'
          });
        }
        
        setDefaultTree(tree);
      } catch (err) {
        console.error('Failed to initialize WorkerAPIClient:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize');
      } finally {
        setLoading(false);
      }
    }
    
    initClient();
  }, []);

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
          <CircularProgress />
          <Typography>Initializing TreeConsole Demo...</Typography>
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">
          <Typography variant="h6">Error</Typography>
          <Typography>{error}</Typography>
        </Alert>
      </Container>
    );
  }

  if (!client || !defaultTree) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="warning">
          <Typography>No client or tree available</Typography>
        </Alert>
      </Container>
    );
  }

  // ルートノードIDを構築 (TreeId + "Root" suffix)
  const rootNodeId = `${defaultTree.treeId}Root` as TreeNodeId;

  return (
    <Container maxWidth={false} disableGutters sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* ヘッダー */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', backgroundColor: 'background.paper' }}>
        <Typography variant="h4" component="h1">
          TreeConsole Demo
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Testing @hierarchidb/ui-treeconsole package integration
        </Typography>
        <Typography variant="caption" display="block" sx={{ mt: 1 }}>
          Tree: {defaultTree.name} (ID: {defaultTree.treeId})
        </Typography>
      </Box>

      {/* TreeConsoleコンテナ */}
      <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <TreeTableConsolePanelContext
          treeRootNodeId={rootNodeId}
          nodeId={rootNodeId}
          displayExpandedNode={false}
          hideConsole={false}
          showSearchOnly={false}
          useTrashColumns={false}
          mode="restore"
          close={() => console.log('Close clicked')}
          handleStartTour={() => console.log('Start tour clicked')}
          workerClient={client} // Pass the WorkerAPIClient
        />
      </Box>

      {/* デバッグ情報 */}
      <Box sx={{ p: 1, borderTop: 1, borderColor: 'divider', backgroundColor: 'grey.100' }}>
        <Typography variant="caption" component="div">
          Debug: Client initialized | Tree: {defaultTree.treeId} | Root: {rootNodeId}
        </Typography>
      </Box>
    </Container>
  );
}