/**
 * @file ResourceProjectToggle.tsx
 * @description Toggle button group for switching between Resources and Projects pages
 */

import { Button, ButtonGroup, ButtonProps } from '@mui/material';
import { useLoaderData, useNavigate } from 'react-router';
import { AttachmentIcon, MapIcon } from '@/icons';
import { APP_PREFIX } from '@/config/appDescription';

export type ResourceProjectType = 'resources' | 'projects' | 'none';
export type ResourceProjectToggleOrientation = 'horizontal' | 'vertical';
export type ResourceProjectToggleSize = 'small' | 'medium' | 'large';

interface ResourceProjectToggleProps {
  /** Currently selected type - 'none' for neutral state (Home page) */
  selected?: ResourceProjectType;
  /** Current pageNodeId to preserve in sessionStorage */
  currentPageNodeId?: string;
  /** Button group orientation - horizontal (default) or vertical */
  orientation?: ResourceProjectToggleOrientation;
  /** Button size - small, medium (default), or large */
  size?: ResourceProjectToggleSize;
}

const STORAGE_KEYS = {
  RESOURCES_PAGE_NODE_ID: 'resourcesPageNodeId',
  PROJECTS_PAGE_NODE_ID: 'projectsPageNodeId',
} as const;

export function ResourceProjectToggle({
  selected = 'none',
  currentPageNodeId,
  orientation = 'horizontal',
  size = 'medium',
}: ResourceProjectToggleProps) {
  const navigate = useNavigate();
  const { pageNodeId, isProjectContext } = useLoaderData();
  const { treeNode } = useWorkerServices();

  const handleToggle = async (targetType: 'resources' | 'projects') => {
    // Save current pageNodeId to sessionStorage if we're navigating away from a selected page
    // and the current node actually belongs to the current theme
    if (selected !== 'none' && targetType !== selected && currentPageNodeId && treeNode) {
      const nodeContext = await getNodeContext(pageNodeId as TreeNodeId, treeNode);

      // Only save if the current node actually belongs to the current selected theme
      if (nodeContext === selected) {
        const storageKey =
          selected === 'resources'
            ? STORAGE_KEYS.RESOURCES_PAGE_NODE_ID
            : STORAGE_KEYS.PROJECTS_PAGE_NODE_ID;
        sessionStorage.setItem(storageKey, currentPageNodeId);
      }
    }

    // Get saved pageNodeId for target type
    const targetStorageKey =
      targetType === 'resources'
        ? STORAGE_KEYS.RESOURCES_PAGE_NODE_ID
        : STORAGE_KEYS.PROJECTS_PAGE_NODE_ID;
    const savedPageNodeId = sessionStorage.getItem(targetStorageKey);

    // Navigate to target page
    const basePath = targetType === 'resources' ? 'r' : 'p';
    const targetPath = savedPageNodeId
      ? `/${APP_PREFIX}/t/${basePath}/${savedPageNodeId}`
      : `/${APP_PREFIX}/t/${basePath}`;

    navigate(targetPath, { replace: true });
  };

  return (
    <ButtonGroup
      variant="outlined"
      size={size as ButtonProps['size']}
      orientation={orientation}
      aria-label="Switch between Resources and Projects"
      sx={{
        ...(orientation === 'vertical'
          ? {
              '& .MuiButton-root': {
                justifyContent: 'flex-start',
                textTransform: 'none',
                width: '100%',
              },
            }
          : undefined),
        // Apply rounded corners to match Preview button style
        '& .MuiButtonGroup-grouped': {
          borderRadius: '20px',
          '&:not(:last-of-type)': {
            borderTopRightRadius: 0,
            borderBottomRightRadius: 0,
          },
          '&:not(:first-of-type)': {
            borderTopLeftRadius: 0,
            borderBottomLeftRadius: 0,
          },
        },
      }}
    >
      <Button
        variant={selected === 'resources' ? 'contained' : 'outlined'}
        size={'large'}
        color="primary"
        onClick={() => handleToggle('resources')}
        aria-pressed={selected === 'resources'}
        startIcon={<AttachmentIcon />}
        fullWidth={orientation === 'vertical'}
      >
        Resources
      </Button>
      <Button
        variant={selected === 'projects' ? 'contained' : 'outlined'}
        color="secondary"
        size={'large'}
        onClick={() => handleToggle('projects')}
        aria-pressed={selected === 'projects'}
        startIcon={<MapIcon />}
        fullWidth={orientation === 'vertical'}
      >
        Projects
      </Button>
    </ButtonGroup>
  );
}
