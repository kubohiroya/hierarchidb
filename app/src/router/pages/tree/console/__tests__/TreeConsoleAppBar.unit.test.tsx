import { STAGED_FOLDER_ACTION_RUNTIME_NODE_TYPE } from '@hierarchidb/staged-folder-action';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LoadPageNodeReturn } from '../../../../loaders/treeLoaders';
import { TreeConsoleAppBar } from '../TreeConsoleAppBar';

type QueueComponentProps = {
  treeId?: string;
  nodeType?: string;
  onEntriesChange?: (entries: unknown[]) => void;
};

const badgeProps: QueueComponentProps[] = [];
const panelProps: QueueComponentProps[] = [];
const handleResumeDialogEntriesChange = vi.fn();
const handleStagedFolderActionDialogEntriesChange = vi.fn();

vi.mock('@hierarchidb/ui-plugin-shell/ui-i18n', () => ({
  useGlobalI18nTranslator: () => ({
    t: (_key: string, fallback: string, values?: { count?: number }) =>
      values?.count === undefined ? fallback : fallback.replace('{{count}}', String(values.count)),
  }),
}));

vi.mock('@hierarchidb/ui-plugin-shell/ui-usermenu', () => ({
  UserLoginButton: () => null,
}));

vi.mock('~/components/AppLogoIcon', () => ({
  default: () => <span data-testid="app-logo" />,
}));

vi.mock('~/components/BuildSessionQueuePanel', () => ({
  BuildSessionQueuePanel: (props: QueueComponentProps) => {
    panelProps.push(props);
    return <div data-testid={`panel-${String(props.nodeType)}`} />;
  },
  BuildSessionQueuePanelBadgeButton: (props: QueueComponentProps) => {
    badgeProps.push(props);
    return <button data-testid={`badge-${String(props.nodeType)}`} type="button" />;
  },
}));

vi.mock('../hooks/useTreeConsoleAppBar', () => ({
  useTreeConsoleAppBar: () => ({
    resumeSessionNodeType: 'shape',
    resumeDialogRows: [],
    resumeDialogSessionCount: 0,
    canResumeDialogQueue: false,
    isResumeDialogOpen: false,
    isQueueAutoStartEnabled: true,
    isDeletingQueue: false,
    isResumingQueue: false,
    handleNavigateToBuild: vi.fn(),
    handleNavigateToBuildJobEntry: vi.fn(),
    handleResumeDialogEntriesChange,
    handleStagedFolderActionDialogEntriesChange,
    handleResumeQueue: vi.fn(),
    handleDeleteQueue: vi.fn(),
    handleSkipResumeDialog: vi.fn(),
  }),
}));

describe('TreeConsoleAppBar', () => {
  beforeEach(() => {
    badgeProps.length = 0;
    panelProps.length = 0;
    handleResumeDialogEntriesChange.mockClear();
    handleStagedFolderActionDialogEntriesChange.mockClear();
  });

  it('wires staged-folder-action badge entries into the shared resume dialog state', () => {
    render(
      <TreeConsoleAppBar
        data={
          {
            tree: { id: 'tree-1' },
            pageNodeId: 'page-1',
          } as unknown as LoadPageNodeReturn
        }
        pageName="Tree"
        isUserMenuReady={false}
        onGoHome={vi.fn()}
        onOpenMaintenance={vi.fn()}
      />
    );

    const stagedBadge = badgeProps.find(
      (props) => props.nodeType === STAGED_FOLDER_ACTION_RUNTIME_NODE_TYPE
    );

    expect(stagedBadge).toMatchObject({
      treeId: 'tree-1',
      nodeType: STAGED_FOLDER_ACTION_RUNTIME_NODE_TYPE,
    });
    expect(stagedBadge?.onEntriesChange).toBe(handleStagedFolderActionDialogEntriesChange);
  });
});
