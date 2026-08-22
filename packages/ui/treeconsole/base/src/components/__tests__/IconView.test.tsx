import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNodeInUI } from '@hierarchidb/ui-treeconsole-treetable';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IconView } from '../IconView';

function makeNode(id: string, name: string, overrides?: Partial<TreeNodeInUI>): TreeNodeInUI {
  return {
    id: id as NodeId,
    parentId: 'parent' as NodeId,
    nodeType: 'folder',
    depth: 0,
    createdAt: 100,
    updatedAt: 200,
    version: 1,
    metadata: { name, description: '', tags: [] },
    draftMetadata: null,
    data: null,
    visible: true,
    ...overrides,
  } as TreeNodeInUI;
}

const nodes = [makeNode('a', 'Banana'), makeNode('b', 'Apple'), makeNode('c', 'Cherry')];

describe('IconView', () => {
  it('renders all node names in grid mode', () => {
    render(
      <IconView nodes={nodes} zoomLevel={50} sortMode="name" onIconPositionChange={vi.fn()} />
    );
    expect(screen.getByText('Banana')).toBeInTheDocument();
    expect(screen.getByText('Apple')).toBeInTheDocument();
    expect(screen.getByText('Cherry')).toBeInTheDocument();
  });

  it('renders all node names in free positioning mode', () => {
    render(
      <IconView nodes={nodes} zoomLevel={50} sortMode="none" onIconPositionChange={vi.fn()} />
    );
    expect(screen.getByText('Banana')).toBeInTheDocument();
    expect(screen.getByText('Apple')).toBeInTheDocument();
    expect(screen.getByText('Cherry')).toBeInTheDocument();
  });

  it('renders different container structure for grid vs free mode', () => {
    const { container: gridContainer } = render(
      <IconView nodes={nodes} zoomLevel={50} sortMode="name" onIconPositionChange={vi.fn()} />
    );
    expect(gridContainer.querySelectorAll('[data-node-id]')).toHaveLength(3);
    expect(within(gridContainer).getByText('Sorted by: Name')).toBeInTheDocument();

    const { container: freeContainer } = render(
      <IconView nodes={nodes} zoomLevel={50} sortMode="none" onIconPositionChange={vi.fn()} />
    );
    expect(freeContainer.querySelectorAll('[data-node-id]')).toHaveLength(3);
    expect(within(freeContainer).queryByText('Sorted by: Name')).not.toBeInTheDocument();
  });
});
