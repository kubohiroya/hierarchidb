import '@testing-library/jest-dom/vitest';
import type { BuildSessionRuntimeRecord } from '@hierarchidb/build-api';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BuildSessionQueueSessionRow } from '../BuildSessionQueueSessionRow';

vi.mock('@hierarchidb/ui-i18n', () => ({
  useGlobalI18nTranslator: () => ({
    t: (_key: string, fallback: string) => fallback,
  }),
}));

const nodeId = (value: string): NodeId => value as NodeId;
const nodeType = (value: string): NodeType => value as NodeType;

const createNode = (): TreeNode =>
  ({
    id: nodeId('run-1'),
    parentId: nodeId('root'),
    nodeType: nodeType('folder'),
    metadata: { name: 'staged run', description: undefined, tags: [] },
    depth: 1,
    visible: true,
    createdAt: 100,
    updatedAt: 100,
    version: 1,
  }) as TreeNode;

const createRuntimeRecord = (): BuildSessionRuntimeRecord => ({
  nodeType: nodeType('staged-folder-action'),
  nodeId: nodeId('run-1'),
  status: 'running',
  isActive: true,
  progress: {
    total: 1,
    completed: 0,
    failed: 0,
    skipped: 0,
    percentage: 40,
  },
  currentAction: {
    actionIndex: 0,
    actionType: 'build',
    phase: 'build-session-running',
    percentage: 65,
  },
  startedAt: 100,
  updatedAt: 120,
  revision: 1,
});

describe('BuildSessionQueueSessionRow staged-folder-action progress', () => {
  it('renders currentAction details without adding action-specific top-level statuses', () => {
    render(
      <BuildSessionQueueSessionRow
        row={{
          session: createRuntimeRecord(),
          node: createNode(),
          nodePath: 'root > staged run',
        }}
        index={0}
        compactSummary={false}
        resolveIcon={() => null}
        isRunning={true}
        onNavigate={vi.fn()}
        onDeleteRequest={vi.fn()}
        onStartStoppedSession={vi.fn()}
        onDragStart={vi.fn()}
        onDragEnd={vi.fn()}
        onDragOver={vi.fn()}
      />
    );

    expect(screen.getByText('build - build-session-running')).toBeInTheDocument();
    expect(screen.getByText('65%')).toBeInTheDocument();
    expect(screen.queryByText('build-running')).not.toBeInTheDocument();
  });
});
