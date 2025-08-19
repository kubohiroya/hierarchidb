import type { LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useNavigate } from "react-router";
import { Suspense, useState, useEffect } from "react";
import {
  Box,
  CircularProgress,
  AppBar,
  Toolbar,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  Stack,
} from "@mui/material";
import {
  AccountTree as TreeIcon,
  Folder as FolderIcon,
  Map as MapIcon,
} from "@mui/icons-material";
import { loadTree, LoadTreeArgs } from "~/loader";
import { TreeConsoleIntegration } from "~/components/TreeConsoleIntegration";
import { UserLoginButton } from "@hierarchidb/ui-usermenu";
import { WorkerAPIClient } from "@hierarchidb/ui-client";
import type { Tree } from "@hierarchidb/core";

export async function clientLoader(args: LoaderFunctionArgs) {
  const treeData = await loadTree(args.params as LoadTreeArgs);
  // Load the root node when pageTreeNodeId is not specified
  if (treeData.tree) {
    const rootNode = await treeData.client.getAPI().getNode({
      treeNodeId: treeData.tree.treeRootNodeId,
    });
    return {
      ...treeData,
      rootNode,
    };
  }
  return treeData;
}

export default function TLayout() {
  const data = useLoaderData() as any; // Type workaround for rootNode property
  const navigate = useNavigate();
  const [trees, setTrees] = useState<Tree[]>([]);
  const [selectedTreeId, setSelectedTreeId] = useState<string>(
    data.tree?.treeId || "",
  );

  // Load available trees
  useEffect(() => {
    const loadTrees = async () => {
      try {
        const client = await WorkerAPIClient.getSingleton();
        const api = client.getAPI();
        const availableTrees = await api.getTrees();
        setTrees(availableTrees);
      } catch (error) {
        console.error("Failed to load trees:", error);
      }
    };
    loadTrees();
  }, []);

  // Update selected tree when route changes
  useEffect(() => {
    if (data.tree?.treeId) {
      setSelectedTreeId(data.tree.treeId);
    }
  }, [data.tree?.treeId]);

  // Handle tree switch
  const handleTreeChange = (
    _event: React.MouseEvent<HTMLElement>,
    newTreeId: string | null,
  ) => {
    if (newTreeId && newTreeId !== selectedTreeId) {
      setSelectedTreeId(newTreeId);
      // Navigate to the new tree's root
      navigate(`/t/${newTreeId}`);
    }
  };

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* AppBar with Tree Switcher and UserLoginButton */}
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          {/* Tree Title */}
          <Typography variant="h6" component="div" sx={{ flexGrow: 0, mr: 3 }}>
            {data.tree?.name || "Tree Console"}
          </Typography>

          {/* Tree Switcher Button Group */}
          <Stack direction="row" spacing={2} sx={{ flexGrow: 1 }}>
            <ToggleButtonGroup
              value={selectedTreeId}
              exclusive
              onChange={handleTreeChange}
              aria-label="tree selection"
              size="small"
            >
              {trees.map((tree) => (
                <ToggleButton
                  key={tree.treeId}
                  value={tree.treeId}
                  aria-label={tree.name}
                >
                  {tree.name.toLowerCase().includes("project") ? (
                    <FolderIcon sx={{ mr: 1, fontSize: 20 }} />
                  ) : tree.name.toLowerCase().includes("resource") ? (
                    <MapIcon sx={{ mr: 1, fontSize: 20 }} />
                  ) : (
                    <TreeIcon sx={{ mr: 1, fontSize: 20 }} />
                  )}
                  {tree.name}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Stack>

          {/* User Login Button - Right Aligned */}
          <Box sx={{ ml: "auto" }}>
            <UserLoginButton />
          </Box>
        </Toolbar>
      </AppBar>

      {/* TreeConsole Integration - showing tree root when pageTreeNodeId is not specified */}
      <Box sx={{ flex: 1, overflow: "hidden" }}>
        <Suspense
          fallback={
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "100%",
              }}
            >
              <CircularProgress />
            </Box>
          }
        >
          <TreeConsoleIntegration
            treeId={data.tree?.treeId}
            pageTreeNodeId={data.tree?.treeRootNodeId}
            pageTreeNode={data.rootNode}
          />
        </Suspense>
      </Box>

      {/* Child Routes */}
      <Outlet />
    </Box>
  );
}
