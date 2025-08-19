import { Outlet, useLoaderData, useNavigate } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
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
import { loadPageTreeNode, LoadPageTreeNodeArgs } from "~/loader";
import { TreeConsoleIntegration } from "~/components/TreeConsoleIntegration";
import { UserLoginButton } from "@hierarchidb/ui-usermenu";
import { WorkerAPIClient } from "@hierarchidb/ui-client";
import type { Tree } from "@hierarchidb/core";

export async function clientLoader(args: LoaderFunctionArgs) {
  return await loadPageTreeNode(args.params as LoadPageTreeNodeArgs);
}

export default function TLayout() {
  const data = useLoaderData();
  const navigate = useNavigate();
  const [trees, setTrees] = useState<Tree[]>([]);
  const [selectedTreeId, setSelectedTreeId] = useState<string>(
    data.pageTreeNode?.treeId || "",
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
    if (data.pageTreeNode?.treeId) {
      setSelectedTreeId(data.pageTreeNode.treeId);
    }
  }, [data.pageTreeNode?.treeId]);

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
            {data.pageTreeNode?.name || "Tree Console"}
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

      {/* TreeConsole Integration */}
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
            treeId={data.pageTreeNode?.treeId}
            pageTreeNodeId={data.pageTreeNode?.treeNodeId}
            pageTreeNode={data.pageTreeNode}
          />
        </Suspense>
      </Box>

      {/* Child Routes */}
      <Outlet />
    </Box>
  );
}
