/**
 * @file ResourceProjectToggle.tsx
 * @description Toggle button group for switching between Resources and Projects pages
 */

import { Button, ButtonGroup, ButtonProps } from '@mui/material';
// @ts-ignore - react-router not available in ui-core
const useLoaderData = () => ({}); // Placeholder until moved to proper package
const useNavigate = () => (_path: string, _options?: any) => {}; // Placeholder until moved to proper package
// import { AttachmentIcon, MapIcon } from '~/icons';
import AttachmentIcon from '@mui/icons-material/Attachment';
import MapIcon from '@mui/icons-material/Map';

export type ResourceProjectType = 'resources' | 'projects' | 'none';
export type ResourceProjectToggleOrientation = 'horizontal' | 'vertical';
export type ResourceProjectToggleSize = 'small' | 'medium' | 'large';

interface ResourceProjectToggleProps {
  /** Currently selected type - 'none' for neutral state (Home page) */
  selected?: ResourceProjectType;
  /** Current pageNodeId to preserve */
  currentPageNodeId?: string;
  /** App prefix for routing (optional, only needed if not using React Router basename) */
  appPrefix?: string;
  /** Callback to get saved pageNodeId for a given type */
  getSavedPageNodeId: (type: 'resources' | 'projects') => string | null;
  /** Callback to save pageNodeId for a given type */
  savePageNodeId: (type: 'resources' | 'projects', pageNodeId: string) => void;
  /** Callback to get current page context (resources or projects) */
  getNodeContext?: (pageNodeId: string) => Promise<'resources' | 'projects'>;
  /** Button group orientation - horizontal (default) or vertical */
  orientation?: ResourceProjectToggleOrientation;
  /** Button size - small, medium (default), or large */
  size?: ResourceProjectToggleSize;
}

// Type definitions as stubs
type TreeNodeId = string;

export function ResourceProjectToggle({
  selected = 'none',
  currentPageNodeId,
  appPrefix: _appPrefix,
  getSavedPageNodeId,
  savePageNodeId,
  getNodeContext,
  orientation = 'horizontal',
  size = 'medium',
}: ResourceProjectToggleProps) {
  const navigate = useNavigate();
  
  // Safe handling of loader data that might not be available
  let pageNodeId;
  try {
    ({ pageNodeId } = useLoaderData() as any);
  } catch {
    pageNodeId = undefined;
  }

  const handleToggle = async (targetType: 'resources' | 'projects') => {
    // Save current pageNodeId if we're navigating away from a selected page
    // and the current node actually belongs to the current theme
    if (selected !== 'none' && selected !== 'resources' && selected !== 'projects') {
      // Skip saving for 'none' state
    } else if (selected !== 'none' && targetType !== selected && currentPageNodeId) {
      // If getNodeContext is provided, check if the node belongs to the current context
      if (getNodeContext && pageNodeId) {
        const nodeContext = await getNodeContext(pageNodeId as TreeNodeId);
        // Only save if the current node actually belongs to the current selected theme
        if (nodeContext === selected) {
          savePageNodeId(selected as 'resources' | 'projects', currentPageNodeId);
        }
      } else {
        // If no context check is available, save directly
        savePageNodeId(selected as 'resources' | 'projects', currentPageNodeId);
      }
    }

    // Get saved pageNodeId for target type
    const savedPageNodeId = getSavedPageNodeId(targetType);

    // Navigate to target page (don't include appPrefix since it's already in basename)
    const basePath = targetType === 'resources' ? 'r' : 'p';
    const targetPath = savedPageNodeId
      ? `/t/${basePath}/${savedPageNodeId}`
      : `/t/${basePath}`;

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
