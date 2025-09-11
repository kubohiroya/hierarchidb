import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ResolverDialog } from '../ResolverDialog';

describe('ResolverDialog (ui-dialog integration)', () => {
  it('walks through steps and saves when filled', async () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();

    const working: any = {
      name: 'resolver-1',
      sourceSchema: 'src',
      targetSchema: 'dst',
      mappingRules: [],
      duplicateResolution: { strategy: 'ignore' },
      previewConfig: { sampleSize: 10 },
    };

    render(
      <ResolverDialog
        open={true}
        nodeId={'n1' as any}
        onClose={onCancel}
        onSave={onSave}
        onCancel={onCancel}
        entity={undefined}
      />,
    );

    // Re-render with pre-filled working copy to satisfy validation
    render(
      <ResolverDialog
        open={true}
        nodeId={'n1' as any}
        onClose={onCancel}
        onSave={onSave}
        onCancel={onCancel}
        entity={working}
      />,
    );

    // Move through steps using a11y test controls
    const next = screen.getByLabelText('Next');
    fireEvent.click(next);
    fireEvent.click(next);
    fireEvent.click(next);
    fireEvent.click(next);
    fireEvent.click(next);

    // Complete
    const complete = screen.getByLabelText('Complete');
    fireEvent.click(complete);

    expect(onSave).toHaveBeenCalledTimes(1);
  });
});

